import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({
  getRepository: vi.fn(),
  listOpenPullRequests: vi.fn(),
}));

import { getRepository, listOpenPullRequests } from '@diffy/core';
import { AddRepoRequestSchema } from '../src/module/repos/dto/add-repo.dto';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { AddRepoUsecase } from '../src/module/repos/usecase/add-repo.usecase';
import type { AccountsService } from '../src/module/accounts/accounts.service';
import type { GithubService } from '../src/module/github/github.service';

const add = vi.fn();
const getAccess = vi.fn();
const findById = vi.fn();
const usecase = new AddRepoUsecase(
  { add } as unknown as ReposRepository,
  { getAccess } as unknown as GithubService,
  { findById } as unknown as AccountsService,
);

const info = (over: Record<string, unknown> = {}) => ({
  fullName: 'Acme/Api',
  owner: 'Acme',
  name: 'Api',
  isPrivate: false,
  archived: false,
  ...over,
});

const row = {
  id: 'r1',
  owner: 'Acme',
  name: 'Api',
  enabled: true,
  lastPolledAt: null,
  lastError: null,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
};

beforeEach(() => {
  add.mockReset();
  getAccess.mockReset().mockResolvedValue({ octokit: {}, secrets: [] });
  findById.mockReset().mockResolvedValue({ id: 'acc1', githubId: 4242, login: 'Acme', type: 'Organization' });
  vi.mocked(getRepository).mockReset();
  vi.mocked(listOpenPullRequests).mockReset().mockResolvedValue([]);
});

describe('AddRepoUsecase', () => {
  it('checks the repo with GitHub, saves it with GitHub\'s casing and returns the item', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    add.mockResolvedValue(row);

    const result = await usecase.execute('acc1', { fullName: 'acme/api' });

    expect(getAccess).toHaveBeenCalledWith('acme', 'api');
    expect(vi.mocked(getRepository).mock.calls[0]!.slice(1)).toEqual(['acme', 'api']);
    expect(findById).toHaveBeenCalledWith('acc1');
    expect(add).toHaveBeenCalledWith({ accountId: 'acc1', owner: 'Acme', name: 'Api', baselineShas: [] });
    expect(result).toEqual({
      id: 'r1',
      owner: 'Acme',
      name: 'Api',
      fullName: 'Acme/Api',
      enabled: true,
      lastPolledAt: null,
      lastError: null,
      createdAt: '2026-10-24T01:02:03.000Z',
    });
  });

  it('returns 409 when the repository is already watched', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    add.mockResolvedValue(null);
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 and saves nothing when GitHub does not know the repository', async () => {
    vi.mocked(getRepository).mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(usecase.execute('acc1', { fullName: 'acme/nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(add).not.toHaveBeenCalled();
  });

  it('returns 404 and saves nothing when the repository belongs to another account than the one the person is on', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    findById.mockResolvedValue({ id: 'acc1', githubId: 1, login: 'someone-else', type: 'User' });
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/does not belong to someone-else\. Switch to the account/);
    expect(add).not.toHaveBeenCalled();
  });

  it('compares the owner and the account without caring about case', async () => {
    vi.mocked(getRepository).mockResolvedValue(info({ owner: 'ACME', fullName: 'ACME/Api' }));
    add.mockResolvedValue(row);
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).resolves.toMatchObject({ id: 'r1' });
  });

  it('returns 404 when the account is gone', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    findById.mockResolvedValue(null);
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(NotFoundException);
    expect(add).not.toHaveBeenCalled();
  });

  it('refuses an archived repository', async () => {
    vi.mocked(getRepository).mockResolvedValue(info({ archived: true }));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/archived/);
    expect(add).not.toHaveBeenCalled();
  });

  it('maps a rejected token to 400 and a network failure to 502', async () => {
    vi.mocked(getRepository).mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(BadRequestException);

    vi.mocked(getRepository).mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('does not call GitHub when no token is saved', async () => {
    getAccess.mockRejectedValue(new BadRequestException('Connect your GitHub token in Settings first.'));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/Connect your GitHub token/);
    expect(getRepository).not.toHaveBeenCalled();
  });
});

describe('AddRepoUsecase baseline', () => {
  it('saves the head commit of every open pull request as the baseline', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    vi.mocked(listOpenPullRequests).mockResolvedValue([{ headSha: 'aaa' }, { headSha: 'bbb' }, { headSha: 'ccc' }] as never);
    add.mockResolvedValue(row);

    await usecase.execute('acc1', { fullName: 'acme/api' });

    expect(vi.mocked(listOpenPullRequests).mock.calls[0]!.slice(1)).toEqual(['Acme', 'Api']); // GitHub's casing
    expect(add).toHaveBeenCalledWith({ accountId: 'acc1', owner: 'Acme', name: 'Api', baselineShas: ['aaa', 'bbb', 'ccc'] });
  });

  it('does not add the repository when the open pull requests cannot be read', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    vi.mocked(listOpenPullRequests).mockRejectedValue(new Error('ENOTFOUND'));

    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(BadGatewayException);
    expect(add).not.toHaveBeenCalled();
  });

  it('does not read pull requests of an archived repository', async () => {
    vi.mocked(getRepository).mockResolvedValue(info({ archived: true }));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/archived/);
    expect(add).not.toHaveBeenCalled();
  });
});

describe('AddRepoRequestSchema', () => {
  it('accepts owner/name and trims it', () => {
    expect(AddRepoRequestSchema.parse({ fullName: '  acme/my-repo.js\n' })).toEqual({ fullName: 'acme/my-repo.js' });
  });

  it.each(['', 'acme', 'acme/', '/api', 'acme/api/extra', 'ac me/api', 'https://github.com/acme/api'])(
    'rejects "%s"',
    (fullName) => {
      expect(AddRepoRequestSchema.safeParse({ fullName }).success).toBe(false);
    },
  );

  it('rejects a missing or non-string fullName', () => {
    expect(AddRepoRequestSchema.safeParse({}).success).toBe(false);
    expect(AddRepoRequestSchema.safeParse({ fullName: 5 }).success).toBe(false);
  });
});
