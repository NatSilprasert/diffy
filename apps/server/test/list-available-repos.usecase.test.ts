import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ createGithubClient: vi.fn(() => ({})), listAccessibleRepos: vi.fn() }));

import { listAccessibleRepos } from '@diffy/core';
import type { SettingsService } from '../src/module/settings/settings.service';
import {
  ListAvailableReposUsecase,
  MAX_AVAILABLE_REPOS_RETURNED,
} from '../src/module/repos/usecase/list-available-repos.usecase';

const getGithubToken = vi.fn();
const usecase = new ListAvailableReposUsecase({ getGithubToken } as unknown as SettingsService);

const repo = (fullName: string, isPrivate = false) => {
  const [owner, name] = fullName.split('/') as [string, string];
  return { fullName, owner, name, isPrivate };
};

beforeEach(() => {
  getGithubToken.mockReset().mockResolvedValue('github_pat_x');
  vi.mocked(listAccessibleRepos).mockReset();
});

describe('ListAvailableReposUsecase', () => {
  it('returns everything when no query is given', async () => {
    vi.mocked(listAccessibleRepos).mockResolvedValue([repo('acme/api'), repo('acme/web', true)]);
    const result = await usecase.execute({});
    expect(result.repos.map((r) => r.fullName)).toEqual(['acme/api', 'acme/web']);
    expect(result.hasMore).toBe(false);
  });

  it('filters by a case-insensitive substring of owner/name', async () => {
    vi.mocked(listAccessibleRepos).mockResolvedValue([repo('acme/api'), repo('acme/Web'), repo('bob/apiary')]);
    expect((await usecase.execute({ q: 'API' })).repos.map((r) => r.fullName)).toEqual(['acme/api', 'bob/apiary']);
    expect((await usecase.execute({ q: 'bob/' })).repos.map((r) => r.fullName)).toEqual(['bob/apiary']);
    expect((await usecase.execute({ q: 'nothing' })).repos).toEqual([]);
  });

  it('caps the list and says there is more', async () => {
    const many = Array.from({ length: MAX_AVAILABLE_REPOS_RETURNED + 5 }, (_, i) => repo(`acme/r${i}`));
    vi.mocked(listAccessibleRepos).mockResolvedValue(many);
    const result = await usecase.execute({});
    expect(result.repos).toHaveLength(MAX_AVAILABLE_REPOS_RETURNED);
    expect(result.hasMore).toBe(true);
  });

  it('passes the decrypted token on to GitHub', async () => {
    vi.mocked(listAccessibleRepos).mockResolvedValue([]);
    const { createGithubClient } = await import('@diffy/core');
    await usecase.execute({});
    expect(createGithubClient).toHaveBeenCalledWith('github_pat_x');
  });

  it('maps GitHub 401 to 400 and other failures to 502', async () => {
    vi.mocked(listAccessibleRepos).mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(usecase.execute({})).rejects.toBeInstanceOf(BadRequestException);

    vi.mocked(listAccessibleRepos).mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(usecase.execute({})).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('does not call GitHub when no token is saved', async () => {
    getGithubToken.mockRejectedValue(new BadRequestException('Connect your GitHub token in Settings first.'));
    await expect(usecase.execute({})).rejects.toThrow(/Connect your GitHub token/);
    expect(listAccessibleRepos).not.toHaveBeenCalled();
  });
});
