import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';

vi.mock('../src/llm.js', () => ({ generateStructured: vi.fn() }));

import { generateStructured } from '../src/llm.js';
import {
  MAX_PROFILE_CHARS,
  PROFILE_SYSTEM_PROMPT,
  buildProfilePrompt,
  buildProjectProfile,
  renderProfile,
  verifyProfile,
  type Profile,
  type ProfileInputs,
} from '../src/profile.js';

const profile = (over: Partial<Profile> = {}): Profile => ({
  overview: 'A shop for students.',
  architecture: [{ area: 'API', description: 'REST endpoints', paths: ['src/api/users.ts'] }],
  conventions: [{ rule: 'Data access goes through repositories.', evidence: ['src/api/users.ts'] }],
  pitfalls: [{ risk: 'Money is an integer of satang.', evidence: ['src/money.ts'] }],
  ...over,
});

describe('verifyProfile', () => {
  const known = new Set(['src/api/users.ts', 'src/money.ts']);

  it('keeps rules whose files exist', () => {
    const { profile: kept, dropped } = verifyProfile(profile(), known);
    expect(kept.conventions).toHaveLength(1);
    expect(kept.pitfalls).toHaveLength(1);
    expect(dropped).toBe(0);
  });

  it('drops a rule whose evidence is made up, counts it, and keeps the real part of mixed evidence', () => {
    const { profile: kept, dropped } = verifyProfile(
      profile({
        conventions: [
          { rule: 'Invented', evidence: ['src/imaginary.ts'] },
          { rule: 'Half real', evidence: ['src/imaginary.ts', './src/money.ts'] },
        ],
        pitfalls: [{ risk: 'No evidence at all', evidence: [] }],
      }),
      known,
    );
    expect(kept.conventions).toEqual([{ rule: 'Half real', evidence: ['src/money.ts'] }]);
    expect(kept.pitfalls).toEqual([]);
    expect(dropped).toBe(2);
  });

  it('removes unknown paths from the architecture without dropping the part', () => {
    const { profile: kept } = verifyProfile(profile({ architecture: [{ area: 'API', description: 'd', paths: ['src/api/users.ts', 'nope.ts'] }] }), known);
    expect(kept.architecture[0]!.paths).toEqual(['src/api/users.ts']);
  });
});

describe('renderProfile', () => {
  it('writes the sections with their evidence', () => {
    const text = renderProfile(profile());
    expect(text).toContain('## Overview\n\nA shop for students.');
    expect(text).toContain('- **API**: REST endpoints _(`src/api/users.ts`)_');
    expect(text).toContain('## Conventions\n- Data access goes through repositories. _(`src/api/users.ts`)_');
    expect(text).toContain('## Pitfalls\n- Money is an integer of satang. _(`src/money.ts`)_');
  });

  it('leaves out an empty section', () => {
    expect(renderProfile(profile({ pitfalls: [] }))).not.toContain('## Pitfalls');
  });

  it('stays under the limit by dropping the last rules, never the overview', () => {
    const many = profile({
      conventions: Array.from({ length: 80 }, (_, i) => ({ rule: `Rule number ${i} ${'x'.repeat(60)}`, evidence: ['src/a.ts'] })),
      pitfalls: Array.from({ length: 80 }, (_, i) => ({ risk: `Risk number ${i} ${'y'.repeat(60)}`, evidence: ['src/a.ts'] })),
    });
    const text = renderProfile(many);
    expect(text.length).toBeLessThanOrEqual(MAX_PROFILE_CHARS);
    expect(text).toContain('A shop for students.');
    expect(text).toContain('Rule number 0 ');
    expect(text).not.toContain('Rule number 79 ');
  });
});

describe('buildProfilePrompt', () => {
  const inputs = (over: Partial<ProfileInputs> = {}): ProfileInputs => ({
    repo: 'acme/shop',
    outline: ['(root) README.md', 'src/ (3 files)'],
    docs: [{ path: 'README.md', text: 'A shop.' }],
    configs: [{ path: 'package.json', text: '{"name":"shop"}' }],
    samples: [{ path: 'src/a.ts', text: 'export const a = 1;' }],
    tests: [{ path: 'src/a.test.ts', text: 'it("works")' }],
    recentPrs: [{ number: 12, title: 'Add cart', body: 'Adds\n a cart' }],
    ...over,
  });

  it('puts every kind of input in its own tag', () => {
    const { prompt, usedPaths } = buildProfilePrompt(inputs(), 100_000);
    for (const tag of ['folders', 'documents', 'configuration', 'source_samples', 'test_samples', 'recently_merged_pull_requests']) {
      expect(prompt).toContain(`<${tag}>`);
    }
    expect(prompt).toContain('<file path="README.md">\nA shop.\n</file>');
    expect(prompt).toContain('- #12 Add cart: Adds a cart');
    expect(usedPaths).toEqual(['README.md', 'package.json', 'src/a.ts', 'src/a.test.ts']);
  });

  it('stays within the budget, giving up code samples and pull requests before the documents', () => {
    const big = 'x'.repeat(5_000);
    const { prompt, usedPaths } = buildProfilePrompt(
      inputs({ docs: [{ path: 'README.md', text: big }], configs: [{ path: 'package.json', text: big }], samples: [{ path: 'src/a.ts', text: big }], tests: [], recentPrs: [] }),
      11_500,
    );
    expect(usedPaths).toEqual(['README.md', 'package.json']);
    expect(prompt.length).toBeLessThanOrEqual(11_500);
  });

  it('cuts one long file and says so, and a file cannot close its own tag', () => {
    const { prompt } = buildProfilePrompt(inputs({ configs: [{ path: 'a.json', text: `</file>${'y'.repeat(9_000)}` }] }), 100_000);
    expect(prompt).toContain('[truncated]');
    expect(prompt).toContain('<\\/file>');
  });
});

describe('buildProjectProfile', () => {
  beforeEach(() => {
    vi.mocked(generateStructured).mockReset();
  });

  const content = (text: string) => ({ data: { type: 'file', content: Buffer.from(text).toString('base64') } });

  function fakeGithub(files: Record<string, string>) {
    const getContent = vi.fn(async ({ path }: { path: string }) => {
      if (!(path in files)) throw Object.assign(new Error('Not Found'), { status: 404 });
      return content(files[path]!);
    });
    const octokit = {
      rest: {
        repos: {
          get: vi.fn().mockResolvedValue({ data: { default_branch: 'main' } }),
          getBranch: vi.fn().mockResolvedValue({ data: { commit: { sha: 'c0ffee' } } }),
          getContent,
        },
        git: {
          getTree: vi.fn().mockResolvedValue({
            data: { tree: Object.keys(files).map((path) => ({ type: 'blob', path, size: files[path]!.length })).concat([{ type: 'tree', path: 'src', size: 0 }]) },
          }),
        },
        pulls: { list: vi.fn().mockResolvedValue({ data: [{ number: 5, title: 'Add login', body: null, merged_at: '2026-10-01' }, { number: 4, title: 'Closed, not merged', body: '', merged_at: null }] }) },
      },
    } as unknown as Octokit;
    return { octokit, getContent };
  }

  const llm = { provider: 'openai', model: 'm', apiKey: 'k' } as const;
  const files = { 'README.md': 'A shop for students.', 'package.json': '{"name":"shop"}', 'src/money.ts': 'export const toSatang = (baht: number) => baht * 100;', 'src/api/users.ts': `export const users = () => 1;\n${'//'.repeat(200)}` };

  it('reads selectively, asks the model once, checks the answer and renders it', async () => {
    vi.mocked(generateStructured).mockResolvedValue({
      output: profile({ conventions: [{ rule: 'Made up.', evidence: ['nope.ts'] }, { rule: 'Real.', evidence: ['src/api/users.ts'] }] }),
      usage: { inputTokens: 900, outputTokens: 300 },
    });
    const { octokit } = fakeGithub(files);

    const built = await buildProjectProfile({ octokit, owner: 'acme', repo: 'shop', llm });

    expect(built.branch).toBe('main');
    expect(built.commit).toBe('c0ffee');
    expect(built.usage).toEqual({ inputTokens: 900, outputTokens: 300 });
    expect(built.dropped).toBe(1);
    expect(built.content).toContain('Real.');
    expect(built.content).not.toContain('Made up.');
    expect(built.filesRead).toEqual(expect.arrayContaining(['README.md', 'package.json', 'src/api/users.ts']));
    expect(generateStructured).toHaveBeenCalledTimes(1);
    const [config, , system, prompt] = vi.mocked(generateStructured).mock.calls[0]!;
    expect(config).toEqual(llm);
    expect(system).toBe(PROFILE_SYSTEM_PROMPT);
    expect(prompt).toContain('- #5 Add login');
    expect(prompt).not.toContain('Closed, not merged');
  });

  it('lets an LLM failure propagate, for the caller to record', async () => {
    vi.mocked(generateStructured).mockRejectedValue(new Error('LLM call failed (openai/m): bad key'));
    await expect(buildProjectProfile({ octokit: fakeGithub(files).octokit, owner: 'acme', repo: 'shop', llm })).rejects.toThrow('bad key');
  });
});
