import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { ReviewsRepository } from '../src/module/reviews/reviews.repository';

const data = { repositoryId: 'r1', prNumber: 7, prTitle: 't', prUrl: 'u', headSha: 'abc' };
const uniqueError = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });

const repoWith = (review: Record<string, unknown>) => new ReviewsRepository({ review } as unknown as PrismaService);

describe('ReviewsRepository.createQueued', () => {
  it('returns the new row with created: true', async () => {
    const row = { id: 'v1' };
    const result = await repoWith({ create: vi.fn().mockResolvedValue(row) }).createQueued(data);
    expect(result).toEqual({ review: row, created: true });
  });

  it('returns the existing row with created: false on a unique violation', async () => {
    const existing = { id: 'old' };
    const findUnique = vi.fn().mockResolvedValue(existing);
    const result = await repoWith({ create: vi.fn().mockRejectedValue(uniqueError()), findUnique }).createQueued(data);

    expect(result).toEqual({ review: existing, created: false });
    expect(findUnique).toHaveBeenCalledWith({
      where: { repositoryId_prNumber_headSha: { repositoryId: 'r1', prNumber: 7, headSha: 'abc' } },
    });
  });

  it('rethrows when the conflicting row cannot be found (do not hide a real problem)', async () => {
    const repo = repoWith({ create: vi.fn().mockRejectedValue(uniqueError()), findUnique: vi.fn().mockResolvedValue(null) });
    await expect(repo.createQueued(data)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rethrows every other error', async () => {
    const repo = repoWith({ create: vi.fn().mockRejectedValue(new Error('connection lost')) });
    await expect(repo.createQueued(data)).rejects.toThrow('connection lost');
  });
});

describe('ReviewsRepository.listPage', () => {
  it('asks for one more row than the limit, newest first, with a stable tie-breaker', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({ status: 'failed' }, 20);
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'failed' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      include: { repository: true },
    });
  });

  it('continues after the cursor row without repeating it', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({}, 5, 'v9');
    expect(findMany.mock.calls[0]![0]).toMatchObject({ cursor: { id: 'v9' }, skip: 1, take: 6 });
  });
});

describe('ReviewsRepository.countFindingsBySeverity', () => {
  it('skips the query when there are no reviews', async () => {
    const groupBy = vi.fn();
    expect(await new ReviewsRepository({ finding: { groupBy } } as unknown as PrismaService).countFindingsBySeverity([])).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it('flattens the grouped counts', async () => {
    const groupBy = vi.fn().mockResolvedValue([{ reviewId: 'v1', severity: 'high', _count: { _all: 3 } }]);
    const repo = new ReviewsRepository({ finding: { groupBy } } as unknown as PrismaService);
    expect(await repo.countFindingsBySeverity(['v1'])).toEqual([{ reviewId: 'v1', severity: 'high', count: 3 }]);
  });
});
