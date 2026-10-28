import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({
  createGithubClient: vi.fn((token: string) => ({ pat: token })),
  createGithubApp: vi.fn(() => ({ app: true })),
  getRepoInstallationClient: vi.fn(),
  getInstallationClient: vi.fn(),
  listAccessibleRepos: vi.fn(),
  listAppInstallations: vi.fn(),
  listInstallationRepos: vi.fn(),
}));
vi.mock('../src/infra/github/app-private-key', () => ({ readAppPrivateKey: vi.fn(() => 'PRIVATE-KEY') }));

import {
  createGithubApp,
  getInstallationClient,
  getRepoInstallationClient,
  listAccessibleRepos,
  listAppInstallations,
  listInstallationRepos,
} from '@diffy/core';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Env } from '../src/infra/config/env';
import { readAppPrivateKey } from '../src/infra/github/app-private-key';
import { GithubService } from '../src/module/github/github.service';
import type { SettingsService } from '../src/module/settings/settings.service';

const getGithubToken = vi.fn();
const appEnv = { GITHUB_APP_ID: 5507932, GITHUB_APP_PRIVATE_KEY_PATH: 'app.pem' } as Env;
const service = (env: Partial<Env> = appEnv) => new GithubService(env as Env, { getGithubToken } as unknown as SettingsService);

const repo = (fullName: string) => {
  const [owner, name] = fullName.split('/') as [string, string];
  return { fullName, owner, name, isPrivate: false };
};

beforeEach(() => {
  getGithubToken.mockReset().mockResolvedValue('github_pat_x');
  vi.mocked(createGithubApp).mockClear();
  vi.mocked(readAppPrivateKey).mockClear();
  vi.mocked(getRepoInstallationClient).mockReset().mockResolvedValue({ installation: true } as never);
  vi.mocked(getInstallationClient).mockReset().mockImplementation(async (_app, id) => ({ id }) as never);
  vi.mocked(listAccessibleRepos).mockReset();
  vi.mocked(listAppInstallations).mockReset();
  vi.mocked(listInstallationRepos).mockReset();
});

describe('GithubService.isAppMode', () => {
  it('needs both the App id and the key path', () => {
    expect(service().isAppMode()).toBe(true);
    expect(service({}).isAppMode()).toBe(false);
    expect(service({ GITHUB_APP_ID: 1 }).isAppMode()).toBe(false);
    expect(service({ GITHUB_APP_PRIVATE_KEY_PATH: 'app.pem' }).isAppMode()).toBe(false);
  });
});

describe('GithubService.getAccess', () => {
  it('acts through the installation of the repository, with no secret to hide', async () => {
    const access = await service().getAccess('acme', 'api');

    expect(access).toEqual({ octokit: { installation: true }, secrets: [] });
    expect(createGithubApp).toHaveBeenCalledWith({ appId: 5507932, privateKey: 'PRIVATE-KEY' });
    expect(vi.mocked(getRepoInstallationClient).mock.calls[0]!.slice(1)).toEqual(['acme', 'api']);
    expect(getGithubToken).not.toHaveBeenCalled();
  });

  it('makes the App once, however many repositories are asked for', async () => {
    const s = service();
    await s.getAccess('acme', 'api');
    await s.getAccess('acme', 'web');
    expect(createGithubApp).toHaveBeenCalledTimes(1);
  });

  it('uses the saved personal token without the App, and says it is a secret', async () => {
    expect(await service({}).getAccess('acme', 'api')).toEqual({ octokit: { pat: 'github_pat_x' }, secrets: ['github_pat_x'] });
    expect(createGithubApp).not.toHaveBeenCalled();
  });

  it('answers 503 with the reason when the key cannot be read', async () => {
    vi.mocked(readAppPrivateKey).mockImplementationOnce(() => {
      throw new Error('Cannot read the GitHub App private key at app.pem');
    });
    const error = await service().getAccess('acme', 'api').catch((err) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toMatch(/Cannot read the GitHub App private key/);
  });

  it('passes on the error when the App is not installed on the repository', async () => {
    vi.mocked(getRepoInstallationClient).mockRejectedValue(Object.assign(new Error('diffy is not installed'), { status: 404 }));
    await expect(service().getAccess('acme', 'api')).rejects.toMatchObject({ status: 404 });
  });
});

describe('GithubService.listRepos', () => {
  it('gathers the repositories of every installation of the App, sorted', async () => {
    vi.mocked(listAppInstallations).mockResolvedValue([{ id: 1, account: 'zed', repositorySelection: 'all' }, { id: 2, account: 'acme', repositorySelection: 'selected' }]);
    vi.mocked(listInstallationRepos).mockImplementation(async (client) => ((client as unknown as { id: number }).id === 1 ? [repo('zed/web')] : [repo('acme/api')]));

    expect((await service().listRepos()).map((r) => r.fullName)).toEqual(['acme/api', 'zed/web']);
    expect(listAccessibleRepos).not.toHaveBeenCalled();
  });

  it('lists what the token can see without the App', async () => {
    vi.mocked(listAccessibleRepos).mockResolvedValue([repo('acme/api')]);
    expect(await service({}).listRepos()).toEqual([repo('acme/api')]);
  });
});
