import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { RetryReviewUsecase } from '../src/module/reviews/usecase/retry-review.usecase';
import type { ReviewQueueService } from '../src/module/reviews/worker/review-queue.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  repositoryId: 'r1',
  prNumber: 7,
  prTitle: 'Add login',
  prUrl: 'https://github.com/acme/api/pull/7',
  headSha: 'abc1234',
  status: 'failed',
  error: 'LLM call failed',
  githubReviewUrl: null,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
  finishedAt: new Date('2026-10-24T01:03:00.000Z'),
  ...over,
});

function setup(found: unknown, requeued: unknown) {
  const findById = vi.fn().mockResolvedValue(found);
  const requeueIfFinished = vi.fn().mockResolvedValue(requeued);
  const enqueue = vi.fn();
  const usecase = new RetryReviewUsecase(
    { findById, requeueIfFinished } as unknown as ReviewsRepository,
    { enqueue } as unknown as ReviewQueueService,
  );
  return { usecase, requeueIfFinished, enqueue };
}

describe('RetryReviewUsecase', () => {
  it('puts a failed review back in the queue and returns it as queued', async () => {
    const { usecase, enqueue } = setup(row(), row({ status: 'queued', error: null, finishedAt: null }));

    const result = await usecase.execute({ id: 'v1' });

    expect(enqueue).toHaveBeenCalledWith('v1');
    expect(result).toMatchObject({ id: 'v1', status: 'queued', error: null, finishedAt: null });
  });

  it('returns 404 for an unknown review and touches nothing', async () => {
    const { usecase, requeueIfFinished, enqueue } = setup(null, null);
    await expect(usecase.execute({ id: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(requeueIfFinished).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each(['posted', 'skipped'])('runs a %s review again too', async (status) => {
    const { usecase, enqueue } = setup(row({ status, error: null }), row({ status: 'queued', error: null, finishedAt: null }));
    await expect(usecase.execute({ id: 'v1' })).resolves.toMatchObject({ status: 'queued' });
    expect(enqueue).toHaveBeenCalledWith('v1');
  });

  it.each(['queued', 'running'])('returns 409 for a %s review, naming its status', async (status) => {
    const { usecase, enqueue } = setup(row({ status }), null);
    await expect(usecase.execute({ id: 'v1' })).rejects.toBeInstanceOf(ConflictException);
    await expect(usecase.execute({ id: 'v1' })).rejects.toThrow(`This review is ${status}.`);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns 409 when another request won the race (it was finished a moment ago)', async () => {
    const { usecase, enqueue } = setup(row({ status: 'failed' }), null);
    await expect(usecase.execute({ id: 'v1' })).rejects.toBeInstanceOf(ConflictException);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
