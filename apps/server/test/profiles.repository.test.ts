import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { ProfilesRepository } from '../src/module/profiles/profiles.repository';

const repoWith = (repoProfile: Record<string, unknown>) => new ProfilesRepository({ repoProfile } as unknown as PrismaService);
const uniqueError = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });

describe('ProfilesRepository.findRepositoryIdsWithProfile', () => {
  it('returns the ids that have a row, without querying for an empty list', async () => {
    const findMany = vi.fn().mockResolvedValue([{ repositoryId: 'r1' }]);
    expect(await repoWith({ findMany }).findRepositoryIdsWithProfile(['r1', 'r2'])).toEqual(['r1']);
    expect(findMany).toHaveBeenCalledWith({ where: { repositoryId: { in: ['r1', 'r2'] } }, select: { repositoryId: true } });

    const none = vi.fn();
    expect(await repoWith({ findMany: none }).findRepositoryIdsWithProfile([])).toEqual([]);
    expect(none).not.toHaveBeenCalled();
  });
});

describe('ProfilesRepository.createBuilding', () => {
  it('creates the row and says so', async () => {
    const create = vi.fn().mockResolvedValue({});
    expect(await repoWith({ create }).createBuilding('r1')).toBe(true);
    expect(create).toHaveBeenCalledWith({ data: { repositoryId: 'r1' } });
  });

  it('says false on a unique violation (someone else created it first) and rethrows anything else', async () => {
    expect(await repoWith({ create: vi.fn().mockRejectedValue(uniqueError()) }).createBuilding('r1')).toBe(false);
    await expect(repoWith({ create: vi.fn().mockRejectedValue(new Error('connection lost')) }).createBuilding('r1')).rejects.toThrow('connection lost');
  });
});

describe('ProfilesRepository.markBuildingIfIdle', () => {
  it('only touches a profile that is not building, and keeps its content and notes', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    expect(await repoWith({ updateMany }).markBuildingIfIdle('r1')).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({ where: { repositoryId: 'r1', status: { not: 'building' } }, data: { status: 'building', error: null } });
  });

  it('is false when it was already building', async () => {
    expect(await repoWith({ updateMany: vi.fn().mockResolvedValue({ count: 0 }) }).markBuildingIfIdle('r1')).toBe(false);
  });
});

describe('ProfilesRepository results', () => {
  it('saveBuilt marks it ready, clears the error and stamps the time', async () => {
    const update = vi.fn().mockResolvedValue({});
    await repoWith({ update }).saveBuilt('r1', { content: '# p', branch: 'main', builtCommit: 'abc', provider: 'google', model: 'm', inputTokens: 10, outputTokens: 5 });
    const arg = update.mock.calls[0]![0];
    expect(arg.where).toEqual({ repositoryId: 'r1' });
    expect(arg.data).toMatchObject({ status: 'ready', error: null, content: '# p', branch: 'main', builtCommit: 'abc', provider: 'google', model: 'm', inputTokens: 10, outputTokens: 5 });
    expect(arg.data.builtAt).toBeInstanceOf(Date);
  });

  it('markFailed records the error and leaves the old content alone', async () => {
    const update = vi.fn().mockResolvedValue({});
    await repoWith({ update }).markFailed('r1', 'LLM call failed');
    expect(update).toHaveBeenCalledWith({ where: { repositoryId: 'r1' }, data: { status: 'failed', error: 'LLM call failed' } });
  });

  it('updateNotes changes only the notes and says whether there was a row', async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const repo = repoWith({ updateMany });
    expect(await repo.updateNotes('r1', 'Money is in satang.')).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({ where: { repositoryId: 'r1' }, data: { notes: 'Money is in satang.' } });
    expect(await repo.updateNotes('r2', 'x')).toBe(false);
  });

  it('findBuildingRepositoryIds lists the unfinished builds, oldest first', async () => {
    const findMany = vi.fn().mockResolvedValue([{ repositoryId: 'a' }, { repositoryId: 'b' }]);
    expect(await repoWith({ findMany }).findBuildingRepositoryIds()).toEqual(['a', 'b']);
    expect(findMany).toHaveBeenCalledWith({ where: { status: 'building' }, select: { repositoryId: true }, orderBy: { createdAt: 'asc' } });
  });
});

describe('ProfilesRepository.listStatuses', () => {
  it('reads the status of the profiles of one account and leaves out the content', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listStatuses('acc1');
    expect(findMany).toHaveBeenCalledWith({ where: { repository: { accountId: 'acc1' } }, select: { repositoryId: true, status: true, builtAt: true } });
  });
});
