import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ createGithubClient: vi.fn(() => ({})), getRepository: vi.fn() }));

import { createGithubClient, getRepository } from '@diffy/core';
import { AddRepoRequestSchema } from '../src/module/repos/dto/add-repo.dto';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { AddRepoUsecase } from '../src/module/repos/usecase/add-repo.usecase';
import type { SettingsService } from '../src/module/settings/settings.service';

const create = vi.fn();
const getGithubToken = vi.fn();
const usecase = new AddRepoUsecase(
  { create } as unknown as ReposRepository,
  { getGithubToken } as unknown as SettingsService,
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
  create.mockReset();
  getGithubToken.mockReset().mockResolvedValue('github_pat_x');
  vi.mocked(getRepository).mockReset();
  vi.mocked(createGithubClient).mockClear();
});

describe('AddRepoUsecase', () => {
  it('checks the repo with GitHub, saves it with GitHub\'s casing and returns the item', async () => {
    vi.mocked(getRepository).mockResolvedValue(info());
    create.mockResolvedValue(row);

    const result = await usecase.execute({ fullName: 'acme/api' });

    expect(createGithubClient).toHaveBeenCalledWith('github_pat_x');
    expect(vi.mocked(getRepository).mock.calls[0]!.slice(1)).toEqual(['acme', 'api']);
    expect(create).toHaveBeenCalledWith({ owner: 'Acme', name: 'Api' });
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
    create.mockResolvedValue(null);
    await expect(usecase.execute({ fullName: 'acme/api' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 and saves nothing when GitHub does not know the repository', async () => {
    vi.mocked(getRepository).mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(usecase.execute({ fullName: 'acme/nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an archived repository', async () => {
    vi.mocked(getRepository).mockResolvedValue(info({ archived: true }));
    await expect(usecase.execute({ fullName: 'acme/api' })).rejects.toThrow(/archived/);
    expect(create).not.toHaveBeenCalled();
  });

  it('maps a rejected token to 400 and a network failure to 502', async () => {
    vi.mocked(getRepository).mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(usecase.execute({ fullName: 'acme/api' })).rejects.toBeInstanceOf(BadRequestException);

    vi.mocked(getRepository).mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(usecase.execute({ fullName: 'acme/api' })).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('does not call GitHub when no token is saved', async () => {
    getGithubToken.mockRejectedValue(new BadRequestException('Connect your GitHub token in Settings first.'));
    await expect(usecase.execute({ fullName: 'acme/api' })).rejects.toThrow(/Connect your GitHub token/);
    expect(getRepository).not.toHaveBeenCalled();
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
