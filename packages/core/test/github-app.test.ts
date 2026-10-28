import type { App } from 'octokit';
import { describe, expect, it, vi } from 'vitest';
import { getAppIdentity, getRepoInstallationClient, listAppInstallations, listInstallationRepos } from '../src/github-app.js';

// A fake App: `octokit` acts as the App itself, `getInstallationOctokit` as one installation.
function fakeApp(over: { installations?: unknown[]; repoInstallation?: () => Promise<unknown> } = {}) {
  const paginate = vi.fn().mockResolvedValue(over.installations ?? []);
  const getRepoInstallation = vi.fn(over.repoInstallation ?? (async () => ({ data: { id: 11 } })));
  const getAuthenticated = vi.fn().mockResolvedValue({ data: { slug: 'diffy', name: 'diffy' } });
  const getInstallationOctokit = vi.fn(async (id: number) => ({ id }));
  const app = {
    octokit: { paginate, rest: { apps: { listInstallations: Symbol('installations'), getRepoInstallation, getAuthenticated } } },
    getInstallationOctokit,
  } as unknown as App;
  return { app, getRepoInstallation, getInstallationOctokit };
}

describe('getAppIdentity', () => {
  it('tells which App the id and key belong to', async () => {
    expect(await getAppIdentity(fakeApp().app)).toEqual({ slug: 'diffy', name: 'diffy' });
  });
});

describe('listAppInstallations', () => {
  it('names the account and the repository selection of each installation, whatever its kind', async () => {
    const { app } = fakeApp({
      installations: [
        { id: 1, account: { login: 'acme' }, repository_selection: 'selected' },
        { id: 2, account: { slug: 'big-corp' }, repository_selection: 'all' },
        { id: 3, account: null, repository_selection: 'all' },
      ],
    });
    expect(await listAppInstallations(app)).toEqual([
      { id: 1, account: 'acme', repositorySelection: 'selected' },
      { id: 2, account: 'big-corp', repositorySelection: 'all' },
      { id: 3, account: '', repositorySelection: 'all' },
    ]);
  });
});

describe('getRepoInstallationClient', () => {
  it('acts as the installation the App has on that repository', async () => {
    const { app, getRepoInstallation, getInstallationOctokit } = fakeApp();
    const client = await getRepoInstallationClient(app, 'acme', 'api');

    expect(getRepoInstallation).toHaveBeenCalledWith({ owner: 'acme', repo: 'api' });
    expect(getInstallationOctokit).toHaveBeenCalledWith(11);
    expect(client).toMatchObject({ id: 11 });
  });

  it('explains it when the App is not installed there', async () => {
    const { app } = fakeApp({ repoInstallation: async () => { throw Object.assign(new Error('Not Found'), { status: 404 }); } });
    const error = await getRepoInstallationClient(app, 'acme', 'api').catch((err) => err);
    expect(error.message).toBe('diffy is not installed on acme/api, or was not given access to it.');
    expect(error.status).toBe(404);
  });

  it('passes on any other failure unchanged', async () => {
    const { app } = fakeApp({ repoInstallation: async () => { throw Object.assign(new Error('Bad credentials'), { status: 401 }); } });
    await expect(getRepoInstallationClient(app, 'acme', 'api')).rejects.toThrow('Bad credentials');
  });
});

describe('listInstallationRepos', () => {
  const repo = (full: string, extra: Record<string, unknown> = {}) => {
    const [owner, name] = full.split('/');
    return { full_name: full, name, owner: { login: owner }, private: false, archived: false, disabled: false, ...extra };
  };
  const clientWith = (...pages: unknown[][]) =>
    ({
      rest: { apps: { listReposAccessibleToInstallation: Symbol('list') } },
      paginate: { iterator: () => (async function* () { for (const data of pages) yield { data }; })() },
    }) as never;

  it('gathers the repositories of every page, without archived or disabled ones', async () => {
    const client = clientWith([repo('acme/web', { private: true }), repo('acme/old', { archived: true })], [repo('acme/api'), repo('acme/off', { disabled: true })]);
    expect(await listInstallationRepos(client)).toEqual([
      { fullName: 'acme/web', owner: 'acme', name: 'web', isPrivate: true },
      { fullName: 'acme/api', owner: 'acme', name: 'api', isPrivate: false },
    ]);
  });

  it('is empty when the installation was given nothing', async () => {
    expect(await listInstallationRepos(clientWith([]))).toEqual([]);
  });
});
