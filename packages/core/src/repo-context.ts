import type { Octokit } from 'octokit';
import { getFileText } from './github.js';
import { isSafeRepoPath } from './repo-config.js';

// Documents of the project that are read before every review, so the model knows what the project is and what
// its conventions are. They come from the default branch, like .diffy.yaml.
export type ContextDoc = { path: string; text: string; truncated: boolean };

// Files in which a project writes down rules for its tools and contributors. Read first (after context_files).
export const RULE_FILES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md'];
// The first of these that exists is the README.
export const README_FILES = ['README.md', 'README.markdown', 'readme.md', 'README'];
export const CONTRIBUTING_FILES = ['CONTRIBUTING.md'];

// About 7,500 tokens in all, and 2,500 for any one document. The server can change the total with MAX_CONTEXT_CHARS.
export const DEFAULT_MAX_CONTEXT_CHARS = 30_000;
export const MAX_DOC_CHARS = 10_000;
// A document cut shorter than this would say too little to be worth its place.
const MIN_USEFUL_CHARS = 1_000;

// The documents that fit the budget, in the order given. A long document is cut, a document that would not even
// leave room for a useful piece is left out, and one whose text equals an earlier one (AGENTS.md that is a link
// to CLAUDE.md, for instance) is not read twice.
export function fitDocs(candidates: Array<{ path: string; text: string }>, maxChars: number): ContextDoc[] {
  const docs: ContextDoc[] = [];
  const seen = new Set<string>();
  let remaining = maxChars;

  for (const candidate of candidates) {
    const text = candidate.text.trim();
    if (text === '' || seen.has(text)) continue;
    seen.add(text);

    const allowed = Math.min(MAX_DOC_CHARS, remaining);
    if (allowed < MIN_USEFUL_CHARS && text.length > allowed) continue;
    const truncated = text.length > allowed;
    docs.push({ path: candidate.path, text: truncated ? text.slice(0, allowed) : text, truncated });
    remaining -= Math.min(text.length, allowed);
    if (remaining <= 0) break;
  }
  return docs;
}

async function readAny(octokit: Octokit, owner: string, repo: string, paths: string[], ref: string) {
  for (const path of paths) {
    const text = await getFileText(octokit, owner, repo, path, ref).catch(() => undefined);
    if (text !== undefined) return { path, text };
  }
  return undefined;
}

export type LoadedContext = { docs: ContextDoc[]; warnings: string[] };

// Reads the README, the rule files, CONTRIBUTING.md and the `context_files` of the config from `branch`.
// Best effort: a document that cannot be read is simply not used. Only a `context_files` entry that cannot be
// found is reported, because the maintainers asked for it.
export async function loadRepoContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  { contextFiles, maxChars }: { contextFiles: string[]; maxChars: number },
): Promise<LoadedContext> {
  const warnings: string[] = [];
  if (maxChars <= 0) return { docs: [], warnings };

  const explicit = await Promise.all(
    contextFiles.map(async (path) => {
      if (!isSafeRepoPath(path)) {
        warnings.push(`context_files "${path}" must be a path inside the repository. It was ignored.`);
        return undefined;
      }
      const text = await getFileText(octokit, owner, repo, path, branch).catch(() => undefined);
      if (text === undefined) warnings.push(`context_files "${path}" was not found on ${branch}.`);
      return text === undefined ? undefined : { path, text };
    }),
  );
  const rules = await Promise.all(RULE_FILES.map((path) => readAny(octokit, owner, repo, [path], branch)));
  const [readme, contributing] = await Promise.all([
    readAny(octokit, owner, repo, README_FILES, branch),
    readAny(octokit, owner, repo, CONTRIBUTING_FILES, branch),
  ]);

  const candidates = [...explicit, ...rules, readme, contributing].filter((doc): doc is { path: string; text: string } => doc !== undefined);
  return { docs: fitDocs(candidates, maxChars), warnings };
}
