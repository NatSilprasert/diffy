import { describe, expect, it, vi } from 'vitest';
import { GetStatusResponseSchema } from '../src/module/reviews/dto/get-status.dto';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { GetStatusUsecase } from '../src/module/reviews/usecase/get-status.usecase';
import type { ReviewQueueWorker } from '../src/module/reviews/worker/review-queue.worker';

function setup(queue: { queued: number; current: string | null }, review: unknown = null) {
  const findForRun = vi.fn().mockResolvedValue(review);
  const usecase = new GetStatusUsecase({ getState: () => queue } as unknown as ReviewQueueWorker, { findForRun } as unknown as ReviewsRepository);
  return { usecase, findForRun };
}

const running = (accountId = 'acc1') => ({ id: 'v9', prNumber: 12, prTitle: 'Add login', repository: { accountId, owner: 'acme', name: 'api' } });

describe('GetStatusUsecase', () => {
  it('reports an idle worker', async () => {
    const { usecase, findForRun } = setup({ queued: 0, current: null });
    const result = await usecase.execute('acc1');

    expect(result).toEqual({ queue: { waiting: 0, current: null } });
    expect(findForRun).not.toHaveBeenCalled(); // nothing is running, so nothing to look up
  });

  it('names the review being worked on and counts the ones waiting', async () => {
    const { usecase, findForRun } = setup({ queued: 3, current: 'v9' }, running());
    const result = await usecase.execute('acc1');

    expect(findForRun).toHaveBeenCalledWith('v9');
    expect(result.queue).toEqual({
      waiting: 3,
      current: { reviewId: 'v9', repoFullName: 'acme/api', prNumber: 12, prTitle: 'Add login' },
    });
    expect(GetStatusResponseSchema.safeParse(result).success).toBe(true);
  });

  it('does not tell an account what another account is having reviewed, only that the queue is busy', async () => {
    const { usecase } = setup({ queued: 2, current: 'v9' }, running('someone-else'));
    expect((await usecase.execute('acc1')).queue).toEqual({ waiting: 2, current: null });
  });

  it('shows no current job if the running review vanished from the database', async () => {
    const { usecase } = setup({ queued: 0, current: 'gone' }, null);
    expect((await usecase.execute('acc1')).queue.current).toBeNull();
  });
});
