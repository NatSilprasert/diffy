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

  it('leaves out conditions that were not asked for', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({ repositoryId: 'r1', since: new Date('2026-10-01') }, 5);
    expect(findMany.mock.calls[0]![0].where).toStrictEqual({ repositoryId: 'r1', createdAt: { gte: new Date('2026-10-01') } });
  });

  it('searches the title, owner and name for plain text', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({ search: 'cart' }, 5);
    expect(findMany.mock.calls[0]![0].where.OR).toStrictEqual([
      { prTitle: { contains: 'cart', mode: 'insensitive' } },
      { repository: { owner: { contains: 'cart', mode: 'insensitive' } } },
      { repository: { name: { contains: 'cart', mode: 'insensitive' } } },
    ]);
  });

  it('also matches the PR number for "#12" and the start of a commit for hex text', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({ search: '#12' }, 5);
    expect(findMany.mock.calls[0]![0].where.OR).toContainEqual({ prNumber: 12 });
    // "12" is also valid hex, so a short number can match a commit too.
    expect(findMany.mock.calls[0]![0].where.OR).not.toContainEqual({ headSha: { startsWith: '12' } });

    await repoWith({ findMany }).listPage({ search: '78515B5' }, 5);
    expect(findMany.mock.calls[1]![0].where.OR).toContainEqual({ headSha: { startsWith: '78515b5' } });
  });

  it('matches "owner/name" on both sides of the slash', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({ search: 'acme/ap' }, 5);
    expect(findMany.mock.calls[0]![0].where.OR).toContainEqual({
      repository: { owner: { contains: 'acme', mode: 'insensitive' }, name: { contains: 'ap', mode: 'insensitive' } },
    });
  });

  it('ignores a search that is only spaces', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({ search: '   ' }, 5);
    expect(findMany.mock.calls[0]![0].where).toStrictEqual({});
  });

  it('continues after the cursor row without repeating it', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await repoWith({ findMany }).listPage({}, 5, 'v9');
    expect(findMany.mock.calls[0]![0]).toMatchObject({ cursor: { id: 'v9' }, skip: 1, take: 6 });
  });
});

describe('ReviewsRepository.countSince', () => {
  it('counts everything without a start, and only newer rows with one', async () => {
    const count = vi.fn().mockResolvedValue(3);
    const repo = repoWith({ count });
    await repo.countSince();
    await repo.countSince(new Date('2026-10-01'));
    expect(count).toHaveBeenNthCalledWith(1, { where: {} });
    expect(count).toHaveBeenNthCalledWith(2, { where: { createdAt: { gte: new Date('2026-10-01') } } });
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

describe('ReviewsRepository.requeueIfFinished', () => {
  // The transaction callback gets a client of its own; here it is the same fake.
  const withTx = (review: Record<string, unknown>, finding: Record<string, unknown> = {}) => {
    const tx = { review, finding };
    return new ReviewsRepository({ $transaction: (run: (t: typeof tx) => unknown) => run(tx) } as unknown as PrismaService);
  };

  it('only touches a finished review, clears the old result and deletes its findings', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: 'v1', status: 'queued' });
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const result = await withTx({ updateMany, findUnique }, { deleteMany }).requeueIfFinished('v1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', status: { in: ['failed', 'posted', 'skipped'] } },
      data: {
        status: 'queued',
        error: null,
        finishedAt: null,
        summary: null,
        githubReviewUrl: null,
        provider: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({ where: { reviewId: 'v1' } });
    expect(result).toEqual({ id: 'v1', status: 'queued' });
  });

  it('returns null and deletes nothing when it was queued or running', async () => {
    const findUnique = vi.fn();
    const deleteMany = vi.fn();
    const result = await withTx({ updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUnique }, { deleteMany }).requeueIfFinished('v1');
    expect(result).toBeNull();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('ReviewsRepository.recoverUnfinished', () => {
  it('turns running reviews back into queued, then lists all queued ids oldest first', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const findMany = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    expect(await repoWith({ updateMany, findMany }).recoverUnfinished()).toEqual(['a', 'b']);
    expect(updateMany).toHaveBeenCalledWith({ where: { status: 'running' }, data: { status: 'queued' } });
    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'queued' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
  });
});

describe('ReviewsRepository usage queries', () => {
  const sums = (n: number, i: number | null, o: number | null) => ({ _count: { _all: n }, _sum: { inputTokens: i, outputTokens: o } });

  it('totals turn missing sums into zero', async () => {
    const aggregate = vi.fn().mockResolvedValue(sums(3, null, null));
    expect(await repoWith({ aggregate }).usageTotals()).toEqual({ reviews: 3, inputTokens: 0, outputTokens: 0 });
    expect(aggregate.mock.calls[0]![0].where).toEqual({});
  });

  it('limits to a start time when given one', async () => {
    const aggregate = vi.fn().mockResolvedValue(sums(0, null, null));
    await repoWith({ aggregate }).usageTotals(new Date('2026-10-01'));
    expect(aggregate.mock.calls[0]![0].where).toEqual({ createdAt: { gte: new Date('2026-10-01') } });
  });

  it('per model skips reviews without a model', async () => {
    const groupBy = vi.fn().mockResolvedValue([{ provider: 'google', model: 'gemini', ...sums(2, 10, 5) }]);
    const rows = await repoWith({ groupBy }).usageByModel();
    expect(groupBy.mock.calls[0]![0].where).toEqual({ model: { not: null } });
    expect(rows).toEqual([{ provider: 'google', model: 'gemini', reviews: 2, inputTokens: 10, outputTokens: 5 }]);
  });

  it('per repository groups by repository id', async () => {
    const groupBy = vi.fn().mockResolvedValue([{ repositoryId: 'r1', ...sums(1, 1, 1) }]);
    const rows = await repoWith({ groupBy }).usageByRepo();
    expect(groupBy.mock.calls[0]![0].by).toEqual(['repositoryId']);
    expect(rows).toEqual([{ repositoryId: 'r1', reviews: 1, inputTokens: 1, outputTokens: 1 }]);
  });
});
