import { describe, expect, it, vi } from 'vitest';
import { GetStatusResponseSchema } from '../src/module/reviews/dto/get-status.dto';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { GetStatusUsecase } from '../src/module/reviews/usecase/get-status.usecase';
import type { PollerService } from '../src/module/reviews/worker/poller.service';
import type { ReviewQueueService } from '../src/module/reviews/worker/review-queue.service';

const idlePoller = { intervalSeconds: 60, running: false, lastRunAt: null, nextRunAt: null };

function setup(queue: { queued: number; current: string | null }, poller = idlePoller, review: unknown = null) {
  const findForRun = vi.fn().mockResolvedValue(review);
  const usecase = new GetStatusUsecase(
    { getState: () => queue } as unknown as ReviewQueueService,
    { getState: () => poller } as unknown as PollerService,
    { findForRun } as unknown as ReviewsRepository,
  );
  return { usecase, findForRun };
}

describe('GetStatusUsecase', () => {
  it('reports an idle worker', async () => {
    const { usecase, findForRun } = setup({ queued: 0, current: null });
    const result = await usecase.execute();

    expect(result).toEqual({
      queue: { waiting: 0, current: null },
      poller: { intervalSeconds: 60, running: false, lastRunAt: null, nextRunAt: null },
    });
    expect(findForRun).not.toHaveBeenCalled(); // nothing is running, so nothing to look up
  });

  it('names the review being worked on and counts the ones waiting', async () => {
    const { usecase, findForRun } = setup(
      { queued: 3, current: 'v9' },
      idlePoller,
      { id: 'v9', prNumber: 12, prTitle: 'Add login', repository: { owner: 'acme', name: 'api' } },
    );
    const result = await usecase.execute();

    expect(findForRun).toHaveBeenCalledWith('v9');
    expect(result.queue).toEqual({
      waiting: 3,
      current: { reviewId: 'v9', repoFullName: 'acme/api', prNumber: 12, prTitle: 'Add login' },
    });
    expect(GetStatusResponseSchema.safeParse(result).success).toBe(true);
  });

  it('shows no current job if the running review vanished from the database', async () => {
    const { usecase } = setup({ queued: 0, current: 'gone' }, idlePoller, null);
    expect((await usecase.execute()).queue.current).toBeNull();
  });

  it('formats the poller times as ISO strings', async () => {
    const { usecase } = setup(
      { queued: 0, current: null },
      {
        intervalSeconds: 30,
        running: true,
        lastRunAt: new Date('2026-10-24T01:00:00.000Z'),
        nextRunAt: new Date('2026-10-24T01:00:30.000Z'),
      },
    );
    const result = await usecase.execute();
    expect(result.poller).toEqual({
      intervalSeconds: 30,
      running: true,
      lastRunAt: '2026-10-24T01:00:00.000Z',
      nextRunAt: '2026-10-24T01:00:30.000Z',
    });
  });
});
