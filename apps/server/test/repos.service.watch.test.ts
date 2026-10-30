import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ getRepository: vi.fn(), listOpenPullRequests: vi.fn() }));

import { getRepository, listOpenPullRequests } from '@diffy/core';
import type { GithubService } from '../src/module/github/github.service';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { ReposService } from '../src/module/repos/repos.service';

const add = vi.fn();
const softRemoveByName = vi.fn();
const softRemoveAllOfAccount = vi.fn();
const getAccess = vi.fn();
const service = () =>
  new ReposService({ add, softRemoveByName, softRemoveAllOfAccount } as unknown as ReposRepository, { getAccess } as unknown as GithubService);

const info = (over: Record<string, unknown> = {}) => ({ fullName: 'Acme/Api', owner: 'Acme', name: 'Api', isPrivate: false, archived: false, ...over });

beforeEach(() => {
  for (const fn of [add, softRemoveByName, softRemoveAllOfAccount, getAccess]) fn.mockReset();
  getAccess.mockResolvedValue({ octokit: { app: true }, secrets: [] });
  vi.mocked(getRepository).mockReset().mockResolvedValue(info() as never);
  vi.mocked(listOpenPullRequests).mockReset().mockResolvedValue([]);
});

describe('ReposService.lookupOnGithub', () => {
  it('reads the repository as the App and notes the head commit of each open pull request', async () => {
    vi.mocked(listOpenPullRequests).mockResolvedValue([{ headSha: 'aaa' }, { headSha: 'bbb' }] as never);

    expect(await service().lookupOnGithub('acme', 'api')).toEqual({ info: info(), baselineShas: ['aaa', 'bbb'] });
    expect(getAccess).toHaveBeenCalledWith('acme', 'api');
    expect(vi.mocked(listOpenPullRequests).mock.calls[0]!.slice(1)).toEqual(['Acme', 'Api']); // GitHub's casing
  });

  it('throws what GitHub throws', async () => {
    vi.mocked(getRepository).mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(service().lookupOnGithub('acme', 'nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('ReposService.autoWatch', () => {
  it('watches each repository the account gave, with the open pull requests as baseline, and counts them', async () => {
    vi.mocked(listOpenPullRequests).mockResolvedValue([{ headSha: 'aaa' }] as never);
    add.mockResolvedValue({ id: 'r1' });

    expect(await service().autoWatch('acc1', [{ owner: 'Acme', name: 'Api' }, { owner: 'Acme', name: 'Web' }])).toBe(2);
    expect(add).toHaveBeenCalledWith({ accountId: 'acc1', owner: 'Acme', name: 'Api', baselineShas: ['aaa'] });
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('does not count one that was already being watched', async () => {
    add.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'r2' });
    expect(await service().autoWatch('acc1', [{ owner: 'Acme', name: 'Api' }, { owner: 'Acme', name: 'Web' }])).toBe(1);
  });

  it('skips an archived repository, since GitHub does not allow reviews on it', async () => {
    vi.mocked(getRepository).mockResolvedValue(info({ archived: true }) as never);
    expect(await service().autoWatch('acc1', [{ owner: 'Acme', name: 'Api' }])).toBe(0);
    expect(add).not.toHaveBeenCalled();
  });

  it('goes on to the next repository when one cannot be read, and does not save the one without a baseline', async () => {
    vi.mocked(listOpenPullRequests).mockRejectedValueOnce(new Error('ENOTFOUND')).mockResolvedValue([]);
    add.mockResolvedValue({ id: 'r2' });

    expect(await service().autoWatch('acc1', [{ owner: 'Acme', name: 'Api' }, { owner: 'Acme', name: 'Web' }])).toBe(1);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ name: 'Api' }));
  });

  it('does nothing for no repositories', async () => {
    expect(await service().autoWatch('acc1', [])).toBe(0);
    expect(getAccess).not.toHaveBeenCalled();
  });
});

describe('ReposService.unwatch', () => {
  it('stops watching the repositories the account took away, and everything when the App is uninstalled', async () => {
    softRemoveByName.mockResolvedValue(1);
    softRemoveAllOfAccount.mockResolvedValue(3);

    expect(await service().unwatch('acc1', [{ owner: 'Acme', name: 'Api' }])).toBe(1);
    expect(softRemoveByName).toHaveBeenCalledWith('acc1', [{ owner: 'Acme', name: 'Api' }]);
    expect(await service().unwatchAll('acc1')).toBe(3);
    expect(softRemoveAllOfAccount).toHaveBeenCalledWith('acc1');
  });
});
