import type { Octokit } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import { checkProfileFreshness, isProjectDefiningPath, judgeChanges } from '../src/profile-freshness.js';

describe('isProjectDefiningPath', () => {
  it.each(['README.md', 'AGENTS.md', 'CLAUDE.md', '.cursorrules', 'CONTRIBUTING.md', 'docs/ARCHITECTURE.md', 'package.json', 'apps/web/package.json', '.github/workflows/ci.yml', 'prisma/schema/user.prisma'])(
    '%s defines the project',
    (path) => expect(isProjectDefiningPath(path)).toBe(true),
  );

  it.each(['src/app.ts', 'apps/web/src/Button.tsx', 'docs/notes.md', 'a/b/c/package.json'])('%s does not', (path) =>
    expect(isProjectDefiningPath(path)).toBe(false),
  );
});

describe('judgeChanges', () => {
  it('is stale at once when a rule, document or configuration file changed, and names them', () => {
    expect(judgeChanges(['src/a.ts', 'AGENTS.md'])).toEqual({ stale: true, reason: 'AGENTS.md changed' });
    const many = judgeChanges(['README.md', 'package.json', 'tsconfig.json', 'turbo.json']);
    expect(many.reason).toBe('README.md, package.json, tsconfig.json and 1 more changed');
  });

  it('is fresh after a few ordinary code changes', () => {
    expect(judgeChanges(['src/a.ts', 'src/b.ts'])).toEqual({ stale: false, reason: undefined });
  });

  it('is stale after many code changes, not counting lockfiles and build output', () => {
    const code = Array.from({ length: 60 }, (_, i) => `src/f${i}.ts`);
    expect(judgeChanges(code)).toEqual({ stale: true, reason: '60 files changed' });
    expect(judgeChanges([...code.slice(0, 40), ...Array.from({ length: 30 }, (_, i) => `dist/x${i}.js`), 'pnpm-lock.yaml']).stale).toBe(false);
  });

  it('takes the threshold as a parameter', () => {
    expect(judgeChanges(['a.ts', 'b.ts'], 2).stale).toBe(true);
  });
});

describe('checkProfileFreshness', () => {
  const octokitWith = (compare: ReturnType<typeof vi.fn>) => ({ rest: { repos: { compareCommitsWithBasehead: compare } } }) as unknown as Octokit;

  it('is fresh when the branch is still at the commit the profile was built from', async () => {
    const compare = vi.fn().mockResolvedValue({ data: { status: 'identical', files: [], commits: [] } });
    expect(await checkProfileFreshness(octokitWith(compare), 'acme', 'api', 'main', 'abc')).toEqual({ stale: false, reason: undefined, head: 'abc' });
    expect(compare).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', basehead: 'abc...main' });
  });

  it('judges the files changed since, and returns the new head', async () => {
    const compare = vi.fn().mockResolvedValue({ data: { status: 'ahead', files: [{ filename: 'CLAUDE.md' }], commits: [{ sha: 'x' }, { sha: 'def' }] } });
    expect(await checkProfileFreshness(octokitWith(compare), 'acme', 'api', 'main', 'abc')).toEqual({ stale: true, reason: 'CLAUDE.md changed', head: 'def' });
  });

  it('is stale when GitHub cannot compare (rewritten history)', async () => {
    const compare = vi.fn().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    expect(await checkProfileFreshness(octokitWith(compare), 'acme', 'api', 'main', 'abc')).toMatchObject({ stale: true, head: undefined });
  });

  it('throws on any other failure: a rate limit says nothing about the repository', async () => {
    const compare = vi.fn().mockRejectedValue(Object.assign(new Error('rate limited'), { status: 403 }));
    await expect(checkProfileFreshness(octokitWith(compare), 'acme', 'api', 'main', 'abc')).rejects.toThrow('rate limited');
  });
});
