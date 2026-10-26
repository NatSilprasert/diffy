import type { Octokit } from 'octokit';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { getDefaultBranch, getFileText } from './github.js';
import { patternToRegExp } from './gitattributes.js';

// What a repository can set in .diffy.yaml, read from its default branch (never from the pull request itself,
// or whoever opens a PR could switch off the review of that PR).
export type PathInstruction = { path: string; instructions: string };

export type RepoConfig = {
  // The language of the summary, titles and explanations. Fix prompts are always English.
  language: 'en' | 'th';
  // chill: only what matters. assertive: also robustness, tests and maintainability, as low severity.
  profile: 'chill' | 'assertive';
  // Text from `instructions` and from the file `instructions_file` points to, joined.
  instructions: string | undefined;
  pathInstructions: PathInstruction[];
  // Globs of files that are never reviewed.
  ignore: string[];
};

export const DEFAULT_REPO_CONFIG: RepoConfig = {
  language: 'en',
  profile: 'chill',
  instructions: undefined,
  pathInstructions: [],
  ignore: [],
};

export const CONFIG_FILES = ['.diffy.yaml', '.diffy.yml'];
export const MAX_INSTRUCTIONS_CHARS = 20_000;
export const MAX_PATH_INSTRUCTIONS = 50;
export const MAX_PATH_INSTRUCTION_CHARS = 5_000;
export const MAX_IGNORE_PATTERNS = 100;

const Language = z.enum(['en', 'th']);
const Profile = z.enum(['chill', 'assertive']);

// What the file itself holds, before the file that `instructions_file` names is read.
export type ParsedConfig = {
  language: RepoConfig['language'];
  profile: RepoConfig['profile'];
  instructions: string | undefined;
  instructionsFile: string | undefined;
  pathInstructions: PathInstruction[];
  ignore: string[];
  warnings: string[];
};

const KNOWN_KEYS = ['language', 'profile', 'instructions', 'instructions_file', 'path_instructions', 'ignore'];

const describeValue = (value: unknown) => (typeof value === 'string' ? `"${value}"` : JSON.stringify(value));

// Each setting is checked on its own: one wrong value is reported and replaced by its default, and the
// rest of the file still applies. A bad config file must not stop a review.
export function parseRepoConfig(text: string): ParsedConfig {
  const result: ParsedConfig = {
    language: DEFAULT_REPO_CONFIG.language,
    profile: DEFAULT_REPO_CONFIG.profile,
    instructions: undefined,
    instructionsFile: undefined,
    pathInstructions: [],
    ignore: [],
    warnings: [],
  };

  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    result.warnings.push(`The file is not valid YAML, so it was ignored: ${(err as Error).message.split('\n')[0]}`);
    return result;
  }
  if (raw === null || raw === undefined) return result; // an empty file
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    result.warnings.push('The file must be a YAML mapping of settings, so it was ignored.');
    return result;
  }
  const config = raw as Record<string, unknown>;

  for (const key of Object.keys(config)) {
    if (!KNOWN_KEYS.includes(key)) result.warnings.push(`Unknown setting "${key}" was ignored.`);
  }

  if ('language' in config) {
    const parsed = Language.safeParse(config.language);
    if (parsed.success) result.language = parsed.data;
    else result.warnings.push(`language must be "en" or "th", not ${describeValue(config.language)}. Using "en".`);
  }
  if ('profile' in config) {
    const parsed = Profile.safeParse(config.profile);
    if (parsed.success) result.profile = parsed.data;
    else result.warnings.push(`profile must be "chill" or "assertive", not ${describeValue(config.profile)}. Using "chill".`);
  }
  if ('instructions' in config) {
    if (typeof config.instructions === 'string') result.instructions = config.instructions.trim() || undefined;
    else result.warnings.push('instructions must be text. It was ignored.');
  }
  if ('instructions_file' in config) {
    if (typeof config.instructions_file === 'string' && config.instructions_file.trim() !== '') {
      result.instructionsFile = config.instructions_file.trim();
    } else {
      result.warnings.push('instructions_file must be a path in the repository. It was ignored.');
    }
  }

  if ('path_instructions' in config) {
    if (!Array.isArray(config.path_instructions)) {
      result.warnings.push('path_instructions must be a list of { path, instructions }. It was ignored.');
    } else {
      config.path_instructions.forEach((entry: unknown, index: number) => {
        const item = entry as { path?: unknown; instructions?: unknown } | null;
        if (typeof item?.path !== 'string' || item.path.trim() === '' || typeof item.instructions !== 'string' || item.instructions.trim() === '') {
          result.warnings.push(`path_instructions[${index}] needs a "path" and "instructions", both text. It was ignored.`);
          return;
        }
        if (result.pathInstructions.length >= MAX_PATH_INSTRUCTIONS) {
          if (index === MAX_PATH_INSTRUCTIONS) result.warnings.push(`Only the first ${MAX_PATH_INSTRUCTIONS} path_instructions are used.`);
          return;
        }
        const instructions = item.instructions.trim();
        if (instructions.length > MAX_PATH_INSTRUCTION_CHARS) {
          result.warnings.push(`path_instructions[${index}] is longer than ${MAX_PATH_INSTRUCTION_CHARS} characters. It was cut.`);
        }
        result.pathInstructions.push({ path: item.path.trim(), instructions: instructions.slice(0, MAX_PATH_INSTRUCTION_CHARS) });
      });
    }
  }

  if ('ignore' in config) {
    if (!Array.isArray(config.ignore) || !config.ignore.every((pattern) => typeof pattern === 'string' && pattern.trim() !== '')) {
      result.warnings.push('ignore must be a list of path patterns (text). It was ignored.');
    } else {
      result.ignore = config.ignore.map((pattern: string) => pattern.trim());
      if (result.ignore.length > MAX_IGNORE_PATTERNS) {
        result.warnings.push(`Only the first ${MAX_IGNORE_PATTERNS} ignore patterns are used.`);
        result.ignore = result.ignore.slice(0, MAX_IGNORE_PATTERNS);
      }
    }
  }

  return result;
}

// A path inside the repository: no leading slash, no ".." and no backslashes.
export function isSafeRepoPath(path: string): boolean {
  return path !== '' && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..');
}

export type LoadedRepoConfig = { config: RepoConfig; warnings: string[] };

// The matcher for the `ignore` patterns of a config, using the same pattern syntax as .gitattributes.
export function ignoreMatcher(patterns: string[]): (path: string) => boolean {
  if (patterns.length === 0) return () => false;
  const regexps = patterns.map(patternToRegExp);
  return (path) => regexps.some((re) => re.test(path));
}

// Reads .diffy.yaml (and the instructions file it names) from the repository's default branch.
// Never throws: a repository without the file gets the defaults, and anything wrong is reported in `warnings`.
export async function loadRepoConfig(octokit: Octokit, owner: string, repo: string): Promise<LoadedRepoConfig> {
  const warnings: string[] = [];
  try {
    const branch = await getDefaultBranch(octokit, owner, repo);

    let file: { name: string; text: string } | undefined;
    for (const name of CONFIG_FILES) {
      const text = await getFileText(octokit, owner, repo, name, branch);
      if (text !== undefined) {
        file = { name, text };
        break;
      }
    }
    if (!file) return { config: DEFAULT_REPO_CONFIG, warnings };

    const parsed = parseRepoConfig(file.text);
    warnings.push(...parsed.warnings.map((warning) => `${file.name}: ${warning}`));

    const texts = parsed.instructions ? [parsed.instructions] : [];
    if (parsed.instructionsFile) {
      if (!isSafeRepoPath(parsed.instructionsFile)) {
        warnings.push(`${file.name}: instructions_file "${parsed.instructionsFile}" must be a path inside the repository. It was ignored.`);
      } else {
        const text = await getFileText(octokit, owner, repo, parsed.instructionsFile, branch);
        if (text === undefined) warnings.push(`${file.name}: instructions_file "${parsed.instructionsFile}" was not found on ${branch}.`);
        else if (text.trim() !== '') texts.push(text.trim());
      }
    }

    let instructions = texts.join('\n\n') || undefined;
    if (instructions && instructions.length > MAX_INSTRUCTIONS_CHARS) {
      warnings.push(`${file.name}: the instructions are longer than ${MAX_INSTRUCTIONS_CHARS} characters. The rest was cut.`);
      instructions = instructions.slice(0, MAX_INSTRUCTIONS_CHARS);
    }

    return {
      config: {
        language: parsed.language,
        profile: parsed.profile,
        instructions,
        pathInstructions: parsed.pathInstructions,
        ignore: parsed.ignore,
      },
      warnings,
    };
  } catch (err) {
    warnings.push(`Could not read the repository's diffy settings (${(err as Error).message.split('\n')[0]}). Defaults were used.`);
    return { config: DEFAULT_REPO_CONFIG, warnings };
  }
}
