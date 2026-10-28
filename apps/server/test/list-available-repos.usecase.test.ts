import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GithubService } from '../src/module/github/github.service';
import {
  ListAvailableReposUsecase,
  MAX_AVAILABLE_REPOS_RETURNED,
} from '../src/module/repos/usecase/list-available-repos.usecase';

const listRepos = vi.fn();
const usecase = new ListAvailableReposUsecase({ listRepos } as unknown as GithubService);

const repo = (fullName: string, isPrivate = false) => {
  const [owner, name] = fullName.split('/') as [string, string];
  return { fullName, owner, name, isPrivate };
};

beforeEach(() => {
  listRepos.mockReset();
});

describe('ListAvailableReposUsecase', () => {
  it('returns everything when no query is given', async () => {
    listRepos.mockResolvedValue([repo('acme/api'), repo('acme/web', true)]);
    const result = await usecase.execute({});
    expect(result.repos.map((r) => r.fullName)).toEqual(['acme/api', 'acme/web']);
    expect(result.hasMore).toBe(false);
  });

  it('filters by a case-insensitive substring of owner/name', async () => {
    listRepos.mockResolvedValue([repo('acme/api'), repo('acme/Web'), repo('bob/apiary')]);
    expect((await usecase.execute({ q: 'API' })).repos.map((r) => r.fullName)).toEqual(['acme/api', 'bob/apiary']);
    expect((await usecase.execute({ q: 'bob/' })).repos.map((r) => r.fullName)).toEqual(['bob/apiary']);
    expect((await usecase.execute({ q: 'nothing' })).repos).toEqual([]);
  });

  it('caps the list and says there is more', async () => {
    const many = Array.from({ length: MAX_AVAILABLE_REPOS_RETURNED + 5 }, (_, i) => repo(`acme/r${i}`));
    listRepos.mockResolvedValue(many);
    const result = await usecase.execute({});
    expect(result.repos).toHaveLength(MAX_AVAILABLE_REPOS_RETURNED);
    expect(result.hasMore).toBe(true);
  });

  it('maps GitHub 401 to 400 and other failures to 502', async () => {
    listRepos.mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(usecase.execute({})).rejects.toBeInstanceOf(BadRequestException);

    listRepos.mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(usecase.execute({})).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('passes on an error diffy raised itself, such as "connect GitHub first"', async () => {
    listRepos.mockRejectedValue(new BadRequestException('Connect your GitHub token in Settings first.'));
    await expect(usecase.execute({})).rejects.toThrow(/Connect your GitHub token/);
  });
});
