import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';
import { MAX_DOC_CHARS, fitDocs, loadRepoContext } from '../src/repo-context.js';

describe('fitDocs', () => {
  it('keeps documents in the given order', () => {
    expect(fitDocs([{ path: 'a.md', text: 'A' }, { path: 'b.md', text: 'B' }], 30_000).map((d) => d.path)).toEqual(['a.md', 'b.md']);
  });

  it('leaves out empty documents and documents with the same text as an earlier one', () => {
    const docs = fitDocs(
      [
        { path: 'CLAUDE.md', text: 'Same rules.' },
        { path: 'AGENTS.md', text: '  Same rules.\n' },
        { path: 'empty.md', text: '  \n' },
      ],
      30_000,
    );
    expect(docs.map((d) => d.path)).toEqual(['CLAUDE.md']);
  });

  it('cuts a document longer than the per-document limit', () => {
    const [doc] = fitDocs([{ path: 'README.md', text: 'x'.repeat(MAX_DOC_CHARS + 500) }], 100_000);
    expect(doc!.text).toHaveLength(MAX_DOC_CHARS);
    expect(doc!.truncated).toBe(true);
  });

  it('stops at the total budget, cutting the last document that fits only in part', () => {
    const docs = fitDocs([{ path: 'a.md', text: 'a'.repeat(6_000) }, { path: 'b.md', text: 'b'.repeat(6_000) }, { path: 'c.md', text: 'c'.repeat(6_000) }], 10_000);
    expect(docs.map((d) => [d.path, d.text.length, d.truncated])).toEqual([
      ['a.md', 6_000, false],
      ['b.md', 4_000, true],
    ]);
  });

  it('leaves out a document that would only get a sliver of the budget', () => {
    const docs = fitDocs([{ path: 'a.md', text: 'a'.repeat(9_500) }, { path: 'b.md', text: 'b'.repeat(5_000) }], 10_000);
    expect(docs.map((d) => d.path)).toEqual(['a.md']);
  });

  it('still takes a small document into a nearly spent budget', () => {
    const docs = fitDocs([{ path: 'a.md', text: 'a'.repeat(9_500) }, { path: 'tiny.md', text: 'short rule' }], 10_000);
    expect(docs.map((d) => d.path)).toEqual(['a.md', 'tiny.md']);
  });
});

function fakeGithub(files: Record<string, string>) {
  const getContent = vi.fn(async ({ path, ref }: { path: string; ref: string }) => {
    if (ref !== 'main' || !(path in files)) throw Object.assign(new Error('Not Found'), { status: 404 });
    return { data: { type: 'file', content: Buffer.from(files[path]!).toString('base64') } };
  });
  return { octokit: { rest: { repos: { getContent } } } as unknown as Octokit, getContent };
}

const load = (files: Record<string, string>, over: { contextFiles?: string[]; maxChars?: number } = {}) =>
  loadRepoContext(fakeGithub(files).octokit, 'acme', 'api', 'main', { contextFiles: [], maxChars: 30_000, ...over });

describe('loadRepoContext', () => {
  it('reads the README, the rule files and CONTRIBUTING.md, rules before the README', async () => {
    const { docs, warnings } = await load({
      'README.md': 'What it is.',
      'AGENTS.md': 'Agent rules.',
      '.cursorrules': 'Cursor rules.',
      'CONTRIBUTING.md': 'How to help.',
      'src/index.ts': 'not a document',
    });
    expect(docs.map((d) => d.path)).toEqual(['AGENTS.md', '.cursorrules', 'README.md', 'CONTRIBUTING.md']);
    expect(warnings).toEqual([]);
  });

  it('puts the context_files of the config first', async () => {
    const { docs } = await load({ 'README.md': 'R', 'docs/ARCHITECTURE.md': 'Layers.' }, { contextFiles: ['docs/ARCHITECTURE.md'] });
    expect(docs.map((d) => d.path)).toEqual(['docs/ARCHITECTURE.md', 'README.md']);
  });

  it('falls back to other spellings of the README name', async () => {
    expect((await load({ 'readme.md': 'lower case' })).docs.map((d) => d.path)).toEqual(['readme.md']);
  });

  it('has nothing to read, and no warning, for a repository without documents', async () => {
    expect(await load({})).toEqual({ docs: [], warnings: [] });
  });

  it('warns about a context_files entry that is missing or outside the repository, and does not ask for the latter', async () => {
    const { octokit, getContent } = fakeGithub({ 'README.md': 'R' });
    const { docs, warnings } = await loadRepoContext(octokit, 'acme', 'api', 'main', { contextFiles: ['docs/nope.md', '../etc/passwd'], maxChars: 30_000 });
    expect(docs.map((d) => d.path)).toEqual(['README.md']);
    expect(warnings).toHaveLength(2);
    expect(warnings).toEqual(expect.arrayContaining(['context_files "../etc/passwd" must be a path inside the repository. It was ignored.', 'context_files "docs/nope.md" was not found on main.']));
    expect(getContent).not.toHaveBeenCalledWith(expect.objectContaining({ path: '../etc/passwd' }));
  });

  it('reads nothing when the budget is 0', async () => {
    const { octokit, getContent } = fakeGithub({ 'README.md': 'R' });
    expect(await loadRepoContext(octokit, 'acme', 'api', 'main', { contextFiles: [], maxChars: 0 })).toEqual({ docs: [], warnings: [] });
    expect(getContent).not.toHaveBeenCalled();
  });

  it('does not fail when GitHub refuses a document', async () => {
    const getContent = vi.fn(async ({ path }: { path: string }) => {
      if (path === 'README.md') return { data: { type: 'file', content: Buffer.from('R').toString('base64') } };
      throw Object.assign(new Error('rate limited'), { status: 403 });
    });
    const octokit = { rest: { repos: { getContent } } } as unknown as Octokit;
    const { docs } = await loadRepoContext(octokit, 'acme', 'api', 'main', { contextFiles: [], maxChars: 30_000 });
    expect(docs.map((d) => d.path)).toEqual(['README.md']);
  });
});
