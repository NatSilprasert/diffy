import { describe, expect, it, vi } from 'vitest';
import type { ReposService } from '../src/module/repos/repos.service';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { GetUsageUsecase, HEATMAP_DAYS } from '../src/module/reviews/usecase/get-usage.usecase';

const totals = (reviews: number, inputTokens: number, outputTokens: number) => ({ reviews, inputTokens, outputTokens });

function setup(overrides: Partial<Record<keyof ReviewsRepository, unknown>> = {}) {
  const repo = {
    usageTotals: vi.fn(async (_accountId: string, since?: Date) => (since ? totals(2, 100, 50) : totals(5, 900, 400))),
    usageByModel: vi.fn(async (_accountId: string, since?: Date) =>
      since
        ? [{ provider: 'google', model: 'gemini', ...totals(2, 100, 50) }]
        : [
            { provider: 'openai', model: 'gpt', ...totals(1, 50, 10) },
            { provider: 'google', model: 'gemini', ...totals(4, 850, 390) },
          ],
    ),
    usageByRepo: vi.fn(async (_accountId: string, since?: Date) =>
      since ? [{ repositoryId: 'r1', ...totals(2, 100, 50) }] : [{ repositoryId: 'r2', ...totals(1, 5, 5) }, { repositoryId: 'r1', ...totals(4, 895, 395) }],
    ),
    findCreatedAtSince: vi.fn(async () => [] as Date[]),
    ...overrides,
  };
  const names = new Map([['r1', 'acme/api'], ['r2', 'acme/web']]);
  const reposService = { getFullNames: vi.fn(async () => names) };
  return { repo, usecase: new GetUsageUsecase(repo as unknown as ReviewsRepository, reposService as unknown as ReposService) };
}

const now = new Date(2026, 9, 21, 15, 30, 0);

describe('GetUsageUsecase', () => {
  it('returns the all-time and this-month totals', async () => {
    const { usecase, repo } = setup();
    const result = await usecase.execute('acc1', now);
    expect(result.allTime).toEqual(totals(5, 900, 400));
    expect(result.month).toEqual(totals(2, 100, 50));
    expect(repo.usageTotals).toHaveBeenCalledWith('acc1', new Date(2026, 9, 1, 0, 0, 0));
    expect(repo.usageTotals).toHaveBeenCalledWith('acc1');
  });

  it('lists each model once with both periods, biggest token user first', async () => {
    const { usecase } = setup();
    const { byModel } = await usecase.execute('acc1', now);
    expect(byModel.map((m) => m.model)).toEqual(['gemini', 'gpt']);
    expect(byModel[0]).toEqual({ provider: 'google', model: 'gemini', allTime: totals(4, 850, 390), month: totals(2, 100, 50) });
    // Used before this month but not in it: zeros, not missing.
    expect(byModel[1]!.month).toEqual(totals(0, 0, 0));
  });

  it('names repositories and keeps the ones that no longer exist by id', async () => {
    const { usecase } = setup({ usageByRepo: vi.fn(async () => [{ repositoryId: 'gone', ...totals(1, 1, 1) }]) });
    const { byRepo } = await usecase.execute('acc1', now);
    expect(byRepo[0]!.repoFullName).toBe('gone');

    const named = await setup().usecase.execute('acc1', now);
    expect(named.byRepo.map((r) => r.repoFullName)).toEqual(['acme/api', 'acme/web']);
  });

  it('gives one entry per day for 365 days, oldest first, ending today, with empty days as zero', async () => {
    const { usecase } = setup({
      findCreatedAtSince: vi.fn(async () => [new Date(2026, 9, 21, 1, 0), new Date(2026, 9, 21, 23, 0), new Date(2026, 9, 20, 12, 0)]),
    });
    const { days } = await usecase.execute('acc1', now);
    expect(days).toHaveLength(HEATMAP_DAYS);
    expect(days.at(-1)).toEqual({ date: '2026-10-21', count: 2 });
    expect(days.at(-2)).toEqual({ date: '2026-10-20', count: 1 });
    expect(days.at(-3)).toEqual({ date: '2026-10-19', count: 0 });
    expect(days[0]!.date).toBe('2025-10-22');
  });

  it('asks for reviews since the first day shown', async () => {
    const { usecase, repo } = setup();
    await usecase.execute('acc1', now);
    expect(repo.findCreatedAtSince).toHaveBeenCalledWith('acc1', new Date(2025, 9, 22));
  });
});
