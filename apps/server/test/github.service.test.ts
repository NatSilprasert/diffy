import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({
  createGithubApp: vi.fn(() => ({ app: true })),
  getAppIdentity: vi.fn(),
  getRepoInstallationClient: vi.fn(),
  getInstallationClient: vi.fn(),
  listInstallationRepos: vi.fn(),
}));
vi.mock('../src/infra/github/app-private-key', () => ({ readAppPrivateKey: vi.fn(() => 'PRIVATE-KEY') }));

import { createGithubApp, getAppIdentity, getInstallationClient, getRepoInstallationClient, listInstallationRepos } from '@diffy/core';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Env } from '../src/infra/config/env';
import { readAppPrivateKey } from '../src/infra/github/app-private-key';
import type { GithubRepository } from '../src/module/github/github.repository';
import { GithubService } from '../src/module/github/github.service';

const upsertInstallation = vi.fn();
const updateInstallation = vi.fn();
const findActiveInstallationsOfAccount = vi.fn();
const env = { GITHUB_APP_ID: 5507932, GITHUB_APP_PRIVATE_KEY_PATH: 'app.pem' } as Env;
const service = () => new GithubService(env, { upsertInstallation, updateInstallation, findActiveInstallationsOfAccount } as unknown as GithubRepository);

const repo = (fullName: string) => {
  const [owner, name] = fullName.split('/') as [string, string];
  return { fullName, owner, name, isPrivate: false };
};

beforeEach(() => {
  for (const fn of [upsertInstallation, updateInstallation, findActiveInstallationsOfAccount]) fn.mockReset();
  vi.mocked(createGithubApp).mockClear();
  vi.mocked(readAppPrivateKey).mockClear();
  vi.mocked(getAppIdentity).mockReset().mockResolvedValue({ slug: 'diffy-dev', name: 'diffy-dev' });
  vi.mocked(getRepoInstallationClient).mockReset().mockResolvedValue({ installation: true } as never);
  vi.mocked(getInstallationClient).mockReset().mockImplementation(async (_app, id) => ({ id }) as never);
  vi.mocked(listInstallationRepos).mockReset();
});

describe('GithubService.getAccess', () => {
  it('acts through the installation of the repository, with no secret to hide', async () => {
    const access = await service().getAccess('acme', 'api');

    expect(access).toEqual({ octokit: { installation: true }, secrets: [] });
    expect(createGithubApp).toHaveBeenCalledWith({ appId: 5507932, privateKey: 'PRIVATE-KEY' });
    expect(vi.mocked(getRepoInstallationClient).mock.calls[0]!.slice(1)).toEqual(['acme', 'api']);
  });

  it('makes the App once, however many repositories are asked for', async () => {
    const s = service();
    await s.getAccess('acme', 'api');
    await s.getAccess('acme', 'web');
    expect(createGithubApp).toHaveBeenCalledTimes(1);
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
  it('gathers the repositories of the installations of the account, sorted', async () => {
    findActiveInstallationsOfAccount.mockResolvedValue([{ installationId: 1 }, { installationId: 2 }]);
    vi.mocked(listInstallationRepos).mockImplementation(async (client) => ((client as unknown as { id: number }).id === 1 ? [repo('zed/web')] : [repo('acme/api')]));

    expect((await service().listRepos('acc1')).map((r) => r.fullName)).toEqual(['acme/api', 'zed/web']);
    expect(findActiveInstallationsOfAccount).toHaveBeenCalledWith('acc1');
  });

  it('is empty for an account that installed the App nowhere', async () => {
    findActiveInstallationsOfAccount.mockResolvedValue([]);
    expect(await service().listRepos('acc1')).toEqual([]);
    expect(listInstallationRepos).not.toHaveBeenCalled();
  });
});

describe('GithubService.getAppInfo', () => {
  it('names the App and says where to install it, asking GitHub only once', async () => {
    const s = service();
    expect(await s.getAppInfo()).toEqual({ name: 'diffy-dev', slug: 'diffy-dev', installUrl: 'https://github.com/apps/diffy-dev/installations/new' });
    await s.getAppInfo();
    expect(getAppIdentity).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failure', async () => {
    vi.mocked(getAppIdentity).mockRejectedValueOnce(new Error('GitHub is down'));
    const s = service();
    await expect(s.getAppInfo()).rejects.toThrow('GitHub is down');
    expect((await s.getAppInfo()).name).toBe('diffy-dev');
  });
});

describe('GithubService installations', () => {
  it('records and marks installations through the repository', async () => {
    const data = { installationId: 7, accountId: 'acc1', repositorySelection: 'all' };
    updateInstallation.mockResolvedValue(true);

    await service().recordInstallation(data);
    expect(upsertInstallation).toHaveBeenCalledWith(data);

    expect(await service().markInstallation(7, { suspendedAt: null })).toBe(true);
    expect(updateInstallation).toHaveBeenCalledWith(7, { suspendedAt: null });
  });

  it('lists where the App is installed for one account', async () => {
    findActiveInstallationsOfAccount.mockResolvedValue([
      { installationId: 7, account: { login: 'acme', type: 'Organization' }, repositorySelection: 'selected', createdAt: new Date() },
    ]);
    expect(await service().listInstalledAccounts('acc1')).toEqual([{ login: 'acme', type: 'Organization', repositorySelection: 'selected' }]);
  });
});
