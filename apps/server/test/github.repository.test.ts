import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { GithubRepository } from '../src/module/github/github.repository';

const data = { installationId: 7, accountId: 'acc1', repositorySelection: 'all' };

describe('GithubRepository', () => {
  it('creates an installation, or updates a known one and makes it live again', async () => {
    const upsert = vi.fn();
    await new GithubRepository({ githubInstallation: { upsert } } as unknown as PrismaService).upsertInstallation(data);
    expect(upsert).toHaveBeenCalledWith({ where: { installationId: 7 }, create: data, update: { ...data, removedAt: null } });
  });

  it('says whether an installation it updated was known', async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const repository = new GithubRepository({ githubInstallation: { updateMany } } as unknown as PrismaService);

    expect(await repository.updateInstallation(7, { suspendedAt: null })).toBe(true);
    expect(await repository.updateInstallation(8, { removedAt: new Date() })).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({ where: { installationId: 7 }, data: { suspendedAt: null } });
  });
});

describe('GithubRepository.findActiveInstallationsOfAccount', () => {
  it('asks only for the installations of the account that are not uninstalled or suspended', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await new GithubRepository({ githubInstallation: { findMany } } as unknown as PrismaService).findActiveInstallationsOfAccount('acc1');
    expect(findMany).toHaveBeenCalledWith({ where: { accountId: 'acc1', removedAt: null, suspendedAt: null }, include: { account: true }, orderBy: { createdAt: 'asc' } });
  });
});
