import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';
import { MAX_ACCESSIBLE_REPOS, getPullRequest, getRepository, listAccessibleRepos, listOpenPullRequests } from '../src/github.js';

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

const pull = (number: number, over: Record<string, unknown> = {}) => ({
  number,
  title: `PR ${number}`,
  body: 'desc',
  html_url: `https://github.com/acme/api/pull/${number}`,
  draft: false,
  head: { sha: `sha${number}` },
  user: { login: 'dev', type: 'User' },
  ...over,
});

describe('listOpenPullRequests', () => {
  const octokitWith = (pulls: unknown[]) =>
    ({
      rest: { pulls: { list: vi.fn() } },
      paginate: vi.fn().mockResolvedValue(pulls),
    }) as unknown as Octokit;

  it('asks for open pull requests, 100 per page, and maps the fields we use', async () => {
    const octokit = octokitWith([pull(1), pull(2, { draft: true, body: null, user: { login: 'dependabot[bot]', type: 'Bot' } })]);
    const result = await listOpenPullRequests(octokit, 'acme', 'api');

    expect(vi.mocked(octokit.paginate).mock.calls[0]![1]).toEqual({ owner: 'acme', repo: 'api', state: 'open', per_page: 100 });
    expect(result[0]).toEqual({
      owner: 'acme',
      repo: 'api',
      number: 1,
      title: 'PR 1',
      body: 'desc',
      url: 'https://github.com/acme/api/pull/1',
      headSha: 'sha1',
      isDraft: false,
      authorLogin: 'dev',
      authorIsBot: false,
    });
    expect(result[1]).toMatchObject({ isDraft: true, body: '', authorLogin: 'dependabot[bot]', authorIsBot: true });
  });

  it('copes with a pull request whose author account was deleted (user: null)', async () => {
    const result = await listOpenPullRequests(octokitWith([pull(3, { user: null })]), 'acme', 'api');
    expect(result[0]).toMatchObject({ authorLogin: 'ghost', authorIsBot: false });
  });

  it('treats a missing draft flag as not a draft', async () => {
    const { draft: _draft, ...withoutDraft } = pull(4);
    expect((await listOpenPullRequests(octokitWith([withoutDraft]), 'acme', 'api'))[0]!.isDraft).toBe(false);
  });

  it('returns an empty list when nothing is open', async () => {
    expect(await listOpenPullRequests(octokitWith([]), 'acme', 'api')).toEqual([]);
  });
});

describe('getPullRequest', () => {
  it('shares the mapping and also copes with a deleted author', async () => {
    const get = vi.fn().mockResolvedValue({ data: pull(7, { user: null }) });
    const octokit = { rest: { pulls: { get } } } as unknown as Octokit;
    expect(await getPullRequest(octokit, 'acme', 'api', 7)).toMatchObject({ number: 7, authorLogin: 'ghost', headSha: 'sha7' });
    expect(get).toHaveBeenCalledWith({ owner: 'acme', repo: 'api', pull_number: 7 });
  });
});
