import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountsService } from '../src/module/accounts/accounts.service';
import { AddRepoRequestSchema } from '../src/module/repos/dto/add-repo.dto';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import type { ReposService } from '../src/module/repos/repos.service';
import { AddRepoUsecase } from '../src/module/repos/usecase/add-repo.usecase';

const add = vi.fn();
const lookupOnGithub = vi.fn();
const findById = vi.fn();
const usecase = new AddRepoUsecase(
  { add } as unknown as ReposRepository,
  { lookupOnGithub } as unknown as ReposService,
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
const found = (over: Record<string, unknown> = {}, baselineShas: string[] = []) => ({ info: info(over), baselineShas });

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
  lookupOnGithub.mockReset().mockResolvedValue(found());
  findById.mockReset().mockResolvedValue({ id: 'acc1', githubId: 4242, login: 'Acme', type: 'Organization' });
});

describe('AddRepoUsecase', () => {
  it('checks the repo with GitHub, saves it with GitHub\'s casing and returns the item', async () => {
    add.mockResolvedValue(row);

    const result = await usecase.execute('acc1', { fullName: 'acme/api' });

    expect(lookupOnGithub).toHaveBeenCalledWith('acme', 'api');
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
    add.mockResolvedValue(null);
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 and saves nothing when GitHub does not know the repository', async () => {
    lookupOnGithub.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(usecase.execute('acc1', { fullName: 'acme/nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(add).not.toHaveBeenCalled();
  });

  it('returns 404 and saves nothing when the repository belongs to another account than the one the person is on', async () => {
    findById.mockResolvedValue({ id: 'acc1', githubId: 1, login: 'someone-else', type: 'User' });
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/does not belong to someone-else\. Switch to the account/);
    expect(add).not.toHaveBeenCalled();
  });

  it('compares the owner and the account without caring about case', async () => {
    lookupOnGithub.mockResolvedValue(found({ owner: 'ACME', fullName: 'ACME/Api' }));
    add.mockResolvedValue(row);
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).resolves.toMatchObject({ id: 'r1' });
  });

  it('returns 404 when the account is gone', async () => {
    findById.mockResolvedValue(null);
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(NotFoundException);
    expect(add).not.toHaveBeenCalled();
  });

  it('refuses an archived repository', async () => {
    lookupOnGithub.mockResolvedValue(found({ archived: true }));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/archived/);
    expect(add).not.toHaveBeenCalled();
  });

  it('maps a rejected App to 400 and a network failure to 502', async () => {
    lookupOnGithub.mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(BadRequestException);

    lookupOnGithub.mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('passes on an error diffy raised itself instead of hiding it behind "unreachable"', async () => {
    lookupOnGithub.mockRejectedValue(new BadRequestException('The GitHub App is not set up.'));
    await expect(usecase.execute('acc1', { fullName: 'acme/api' })).rejects.toThrow(/not set up/);
  });

  it('saves the head commits of the open pull requests as the baseline', async () => {
    lookupOnGithub.mockResolvedValue(found({}, ['aaa', 'bbb', 'ccc']));
    add.mockResolvedValue(row);
    await usecase.execute('acc1', { fullName: 'acme/api' });
    expect(add).toHaveBeenCalledWith({ accountId: 'acc1', owner: 'Acme', name: 'Api', baselineShas: ['aaa', 'bbb', 'ccc'] });
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
