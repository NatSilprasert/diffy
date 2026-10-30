import { describe, expect, it, vi } from 'vitest';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { GetReviewStatsUsecase } from '../src/module/reviews/usecase/get-review-stats.usecase';

describe('GetReviewStatsUsecase', () => {
  it('counts everything and each window, asking for the window starts of the given moment', async () => {
    const countSince = vi.fn(async (_accountId: string, since?: Date) => (since ? since.getTime() % 1000 : 99));
    const usecase = new GetReviewStatsUsecase({ countSince } as unknown as ReviewsRepository);
    const now = new Date(2026, 9, 21, 15, 30, 0);

    const result = await usecase.execute('acc1', now);

    expect(countSince).toHaveBeenCalledWith('acc1'); // no start: everything
    expect(countSince).toHaveBeenCalledWith('acc1', new Date(2026, 9, 1, 0, 0, 0)); // month
    expect(countSince).toHaveBeenCalledWith('acc1', new Date(2026, 9, 19, 0, 0, 0)); // week
    expect(countSince).toHaveBeenCalledWith('acc1', new Date(now.getTime() - 24 * 3600 * 1000)); // day
    expect(result.total).toBe(99);
  });

  it('maps the four counts to the right fields', async () => {
    const counts = [50, 20, 8, 2];
    const countSince = vi.fn().mockImplementation(() => Promise.resolve(counts.shift()));
    const usecase = new GetReviewStatsUsecase({ countSince } as unknown as ReviewsRepository);
    expect(await usecase.execute('acc1')).toEqual({ total: 50, month: 20, week: 8, day: 2 });
  });
});
