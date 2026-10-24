import { describe, expect, it, vi } from 'vitest';
import { ListReviewsQuerySchema, ListReviewsResponseSchema } from '../src/module/reviews/dto/list-reviews.dto';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { ListReviewsUsecase } from '../src/module/reviews/usecase/list-reviews.usecase';

const row = (n: number) => ({
  id: `v${n}`,
  repositoryId: 'r1',
  prNumber: n,
  prTitle: `PR ${n}`,
  prUrl: `https://github.com/acme/api/pull/${n}`,
  headSha: 'abc',
  status: 'posted' as const,
  summary: null,
  githubReviewUrl: null,
  provider: null,
  model: null,
  inputTokens: null,
  outputTokens: null,
  error: null,
  createdAt: new Date(`2026-10-24T01:00:0${n}.000Z`),
  finishedAt: null,
  repository: { owner: 'acme', name: 'api' },
});

function setup(rows: ReturnType<typeof row>[], counts: Array<{ reviewId: string; severity: string; count: number }> = []) {
  const listPage = vi.fn().mockResolvedValue(rows);
  const countFindingsBySeverity = vi.fn().mockResolvedValue(counts);
  const usecase = new ListReviewsUsecase({ listPage, countFindingsBySeverity } as unknown as ReviewsRepository);
  return { usecase, listPage, countFindingsBySeverity };
}

describe('ListReviewsUsecase', () => {
  it('returns every row and no cursor when the page is not full', async () => {
    const { usecase } = setup([row(3), row(2)]);
    const result = await usecase.execute({ limit: 5 });
    expect(result.reviews.map((r) => r.id)).toEqual(['v3', 'v2']);
    expect(result.nextCursor).toBeNull();
  });

  it('hides the extra look-ahead row and points the cursor at the last visible one', async () => {
    const { usecase, listPage } = setup([row(4), row(3), row(2)]); // limit 2 + 1 look-ahead
    const result = await usecase.execute({ limit: 2 });
    expect(listPage).toHaveBeenCalledWith({ repositoryId: undefined, status: undefined }, 2, undefined);
    expect(result.reviews.map((r) => r.id)).toEqual(['v4', 'v3']);
    expect(result.nextCursor).toBe('v3');
  });

  it('has no next page when the result is exactly one page', async () => {
    const { usecase } = setup([row(2), row(1)]);
    expect((await usecase.execute({ limit: 2 })).nextCursor).toBeNull();
  });

  it('passes the filters and cursor to the repository', async () => {
    const { usecase, listPage } = setup([]);
    await usecase.execute({ limit: 10, cursor: 'v9', repositoryId: 'r1', status: 'failed' });
    expect(listPage).toHaveBeenCalledWith({ repositoryId: 'r1', status: 'failed' }, 10, 'v9');
  });

  it('returns an empty list for an empty result, without counting findings', async () => {
    const { usecase } = setup([]);
    expect(await usecase.execute({ limit: 20 })).toEqual({ reviews: [], nextCursor: null });
  });

  it('counts findings per severity for only the visible rows, with zeros filled in', async () => {
    const { usecase, countFindingsBySeverity } = setup(
      [row(3), row(2), row(1)],
      [
        { reviewId: 'v3', severity: 'critical', count: 1 },
        { reviewId: 'v3', severity: 'low', count: 4 },
        { reviewId: 'v2', severity: 'high', count: 2 },
      ],
    );
    const result = await usecase.execute({ limit: 2 });

    expect(countFindingsBySeverity).toHaveBeenCalledWith(['v3', 'v2']);
    expect(result.reviews[0]!.findingCounts).toEqual({ critical: 1, high: 0, medium: 0, low: 4 });
    expect(result.reviews[1]!.findingCounts).toEqual({ critical: 0, high: 2, medium: 0, low: 0 });
    expect(result.reviews[0]!.repoFullName).toBe('acme/api');
    expect(ListReviewsResponseSchema.safeParse(result).success).toBe(true);
  });
});

describe('ListReviewsQuerySchema', () => {
  it('applies defaults and converts the limit from text', () => {
    expect(ListReviewsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(ListReviewsQuerySchema.parse({ limit: '50', status: 'failed', repositoryId: 'r1' })).toEqual({
      limit: 50,
      status: 'failed',
      repositoryId: 'r1',
    });
  });

  it.each([{ limit: '0' }, { limit: '101' }, { limit: '1.5' }, { limit: 'abc' }, { status: 'QUEUED' }, { status: 'done' }, { cursor: '' }, { repositoryId: '' }])(
    'rejects %j',
    (query) => {
      expect(ListReviewsQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});
