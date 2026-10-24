import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';
import { MAX_ACCESSIBLE_REPOS, getRepository, listAccessibleRepos } from '../src/github.js';

const repo = (name: string, over: Record<string, unknown> = {}) => ({
  full_name: `acme/${name}`,
  name,
  owner: { login: 'acme' },
  private: false,
  archived: false,
  disabled: false,
  ...over,
});

// paginate.iterator yields one { data } object per page.
function fakeOctokit(pages: unknown[][]): Octokit {
  return {
    rest: { repos: { listForAuthenticatedUser: vi.fn() } },
    paginate: {
      iterator: () =>
        (async function* () {
          for (const data of pages) yield { data };
        })(),
    },
  } as unknown as Octokit;
}

describe('listAccessibleRepos', () => {
  it('flattens every page and maps the fields we use', async () => {
    const result = await listAccessibleRepos(
      fakeOctokit([[repo('api'), repo('web', { private: true })], [repo('docs')]]),
    );
    expect(result).toEqual([
      { fullName: 'acme/api', owner: 'acme', name: 'api', isPrivate: false },
      { fullName: 'acme/web', owner: 'acme', name: 'web', isPrivate: true },
      { fullName: 'acme/docs', owner: 'acme', name: 'docs', isPrivate: false },
    ]);
  });

  it('leaves out archived and disabled repositories', async () => {
    const result = await listAccessibleRepos(
      fakeOctokit([[repo('live'), repo('old', { archived: true }), repo('off', { disabled: true })]]),
    );
    expect(result.map((r) => r.name)).toEqual(['live']);
  });

  it('stops at the safety limit', async () => {
    const page = Array.from({ length: 100 }, (_, i) => repo(`r${i}`));
    const pages = Array.from({ length: 15 }, () => page);
    expect(await listAccessibleRepos(fakeOctokit(pages))).toHaveLength(MAX_ACCESSIBLE_REPOS);
  });

  it('returns an empty list when the token sees nothing', async () => {
    expect(await listAccessibleRepos(fakeOctokit([[]]))).toEqual([]);
  });
});

describe('getRepository', () => {
  const octokitReturning = (get: ReturnType<typeof vi.fn>) => ({ rest: { repos: { get } } }) as unknown as Octokit;

  it('returns the repository with GitHub\'s own casing', async () => {
    const get = vi.fn().mockResolvedValue({ data: repo('Api', { full_name: 'Acme/Api', owner: { login: 'Acme' }, private: true }) });
    const result = await getRepository(octokitReturning(get), 'acme', 'api');

    expect(get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api' });
    expect(result).toEqual({ fullName: 'Acme/Api', owner: 'Acme', name: 'Api', isPrivate: true, archived: false });
  });

  it('reports an archived repository', async () => {
    const get = vi.fn().mockResolvedValue({ data: repo('old', { archived: true }) });
    expect((await getRepository(octokitReturning(get), 'acme', 'old')).archived).toBe(true);
  });

  it('lets a 404 propagate so the caller can explain it', async () => {
    const get = vi.fn().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(getRepository(octokitReturning(get), 'acme', 'nope')).rejects.toMatchObject({ status: 404 });
  });
});
