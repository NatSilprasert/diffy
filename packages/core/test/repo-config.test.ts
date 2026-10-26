import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';
import {
  DEFAULT_REPO_CONFIG,
  MAX_INSTRUCTIONS_CHARS,
  MAX_PATH_INSTRUCTIONS,
  ignoreMatcher,
  isSafeRepoPath,
  loadRepoConfig,
  parseRepoConfig,
} from '../src/repo-config.js';

describe('parseRepoConfig', () => {
  it('reads every setting', () => {
    const parsed = parseRepoConfig(`
language: th
profile: assertive
instructions: |
  We use Drizzle. Never write raw SQL.
instructions_file: docs/review.md
path_instructions:
  - path: "src/server/**"
    instructions: Every endpoint must check the user's permissions.
ignore:
  - "public/**"
  - "*.svg"
`);
    expect(parsed).toEqual({
      language: 'th',
      profile: 'assertive',
      instructions: 'We use Drizzle. Never write raw SQL.',
      instructionsFile: 'docs/review.md',
      pathInstructions: [{ path: 'src/server/**', instructions: "Every endpoint must check the user's permissions." }],
      ignore: ['public/**', '*.svg'],
      warnings: [],
    });
  });

  it('gives the defaults for an empty file', () => {
    expect(parseRepoConfig('')).toMatchObject({ language: 'en', profile: 'chill', ignore: [], pathInstructions: [], warnings: [] });
    expect(parseRepoConfig('# only a comment')).toMatchObject({ language: 'en', warnings: [] });
  });

  it('reports a wrong value and keeps the default, while the other settings still apply', () => {
    const parsed = parseRepoConfig('language: fr\nprofile: assertive');
    expect(parsed.language).toBe('en');
    expect(parsed.profile).toBe('assertive');
    expect(parsed.warnings).toEqual(['language must be "en" or "th", not "fr". Using "en".']);
  });

  it('reports an unknown setting, which is usually a typo', () => {
    expect(parseRepoConfig('langauge: th').warnings).toEqual(['Unknown setting "langauge" was ignored.']);
  });

  it('ignores a file that is not valid YAML and says so', () => {
    const parsed = parseRepoConfig('language: [th\n  profile: x');
    expect(parsed.language).toBe('en');
    expect(parsed.warnings[0]).toMatch(/not valid YAML/);
  });

  it.each(['- a\n- b', 'just text'])('ignores a file that is not a mapping (%j)', (text) => {
    expect(parseRepoConfig(text).warnings).toEqual(['The file must be a YAML mapping of settings, so it was ignored.']);
  });

  it('skips a path_instructions entry that is incomplete and keeps the good ones', () => {
    const parsed = parseRepoConfig(`
path_instructions:
  - path: "a/**"
    instructions: ok
  - path: "b/**"
  - instructions: no path
  - "just a string"
`);
    expect(parsed.pathInstructions).toEqual([{ path: 'a/**', instructions: 'ok' }]);
    expect(parsed.warnings).toHaveLength(3);
    expect(parsed.warnings[0]).toContain('path_instructions[1]');
  });

  it('rejects a path_instructions that is not a list, and an ignore that holds non-text', () => {
    expect(parseRepoConfig('path_instructions: nope').warnings[0]).toMatch(/must be a list/);
    expect(parseRepoConfig('ignore:\n  - ok\n  - 5').warnings[0]).toMatch(/ignore must be a list of path patterns/);
    expect(parseRepoConfig('ignore:\n  - ok\n  - 5').ignore).toEqual([]);
  });

  it('uses only the first path_instructions when there are too many', () => {
    const entries = Array.from({ length: MAX_PATH_INSTRUCTIONS + 3 }, (_, i) => `  - path: "p${i}/**"\n    instructions: x`).join('\n');
    const parsed = parseRepoConfig(`path_instructions:\n${entries}`);
    expect(parsed.pathInstructions).toHaveLength(MAX_PATH_INSTRUCTIONS);
    expect(parsed.warnings).toEqual([`Only the first ${MAX_PATH_INSTRUCTIONS} path_instructions are used.`]);
  });
});

describe('isSafeRepoPath', () => {
  it.each([
    ['docs/review.md', true],
    ['REVIEW.md', true],
    ['../secrets.txt', false],
    ['docs/../../x', false],
    ['/etc/passwd', false],
    ['docs\\review.md', false],
    ['', false],
  ])('%s is %s', (path, expected) => {
    expect(isSafeRepoPath(path)).toBe(expected);
  });
});

describe('ignoreMatcher', () => {
  it('matches the patterns and nothing when there are none', () => {
    const ignored = ignoreMatcher(['public/**', '*.svg']);
    expect(ignored('public/logo.png')).toBe(true);
    expect(ignored('src/icons/a.svg')).toBe(true);
    expect(ignored('src/a.ts')).toBe(false);
    expect(ignoreMatcher([])('anything')).toBe(false);
  });
});

// A fake GitHub holding a few files on its default branch.
function fakeGithub(files: Record<string, string>, opts: { defaultBranch?: string; failWith?: { status?: number; message: string } } = {}) {
  const getContent = vi.fn(async ({ path, ref }: { path: string; ref: string }) => {
    if (opts.failWith) throw Object.assign(new Error(opts.failWith.message), { status: opts.failWith.status });
    if (ref !== (opts.defaultBranch ?? 'main') || !(path in files)) throw Object.assign(new Error('Not Found'), { status: 404 });
    return { data: { type: 'file', content: Buffer.from(files[path]!).toString('base64') } };
  });
  const get = vi.fn(async () => ({ data: { default_branch: opts.defaultBranch ?? 'main' } }));
  return { octokit: { rest: { repos: { get, getContent } } } as unknown as Octokit, getContent, get };
}

describe('loadRepoConfig', () => {
  it('gives the defaults, without a word, for a repository with no config file', async () => {
    const { octokit } = fakeGithub({});
    expect(await loadRepoConfig(octokit, 'acme', 'api')).toEqual({ config: DEFAULT_REPO_CONFIG, warnings: [] });
  });

  it('reads the file from the default branch, whatever its name', async () => {
    const { octokit, getContent } = fakeGithub({ '.diffy.yaml': 'language: th' }, { defaultBranch: 'trunk' });
    const { config } = await loadRepoConfig(octokit, 'acme', 'api');
    expect(config.language).toBe('th');
    expect(getContent).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', path: '.diffy.yaml', ref: 'trunk' });
  });

  it('falls back to .diffy.yml', async () => {
    const { octokit } = fakeGithub({ '.diffy.yml': 'profile: assertive' });
    expect((await loadRepoConfig(octokit, 'acme', 'api')).config.profile).toBe('assertive');
  });

  it('adds the instructions file to the instructions, in that order', async () => {
    const { octokit } = fakeGithub({
      '.diffy.yaml': 'instructions: first\ninstructions_file: docs/review.md',
      'docs/review.md': '\nsecond\n',
    });
    expect((await loadRepoConfig(octokit, 'acme', 'api')).config.instructions).toBe('first\n\nsecond');
  });

  it('warns when the instructions file is missing, and still uses the rest', async () => {
    const { octokit } = fakeGithub({ '.diffy.yaml': 'language: th\ninstructions_file: docs/nope.md' });
    const { config, warnings } = await loadRepoConfig(octokit, 'acme', 'api');
    expect(config.language).toBe('th');
    expect(warnings).toEqual(['.diffy.yaml: instructions_file "docs/nope.md" was not found on main.']);
  });

  it('refuses an instructions file outside the repository and never asks GitHub for it', async () => {
    const { octokit, getContent } = fakeGithub({ '.diffy.yaml': 'instructions_file: ../../etc/passwd' });
    const { warnings } = await loadRepoConfig(octokit, 'acme', 'api');
    expect(warnings[0]).toMatch(/must be a path inside the repository/);
    expect(getContent).not.toHaveBeenCalledWith(expect.objectContaining({ path: '../../etc/passwd' }));
  });

  it('cuts instructions that are too long, and says so', async () => {
    const { octokit } = fakeGithub({ '.diffy.yaml': `instructions: ${'x'.repeat(MAX_INSTRUCTIONS_CHARS + 500)}` });
    const { config, warnings } = await loadRepoConfig(octokit, 'acme', 'api');
    expect(config.instructions).toHaveLength(MAX_INSTRUCTIONS_CHARS);
    expect(warnings[0]).toMatch(/longer than 20000 characters/);
  });

  it('prefixes the warnings of the file with its name', async () => {
    const { octokit } = fakeGithub({ '.diffy.yaml': 'language: fr' });
    expect((await loadRepoConfig(octokit, 'acme', 'api')).warnings[0]).toMatch(/^\.diffy\.yaml: language must be/);
  });

  it('never throws: a GitHub failure gives the defaults and a warning', async () => {
    const { octokit } = fakeGithub({}, { failWith: { status: 403, message: 'Resource not accessible' } });
    const { config, warnings } = await loadRepoConfig(octokit, 'acme', 'api');
    expect(config).toEqual(DEFAULT_REPO_CONFIG);
    expect(warnings).toEqual(["Could not read the repository's diffy settings (Resource not accessible). Defaults were used."]);
  });
});
