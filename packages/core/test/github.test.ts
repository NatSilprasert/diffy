import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';
import { MAX_ACCESSIBLE_REPOS, listAccessibleRepos } from '../src/github.js';

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
