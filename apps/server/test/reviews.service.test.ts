import { describe, expect, it, vi } from 'vitest';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { ReviewsService } from '../src/module/reviews/reviews.service';
import type { ReviewQueueWorker } from '../src/module/reviews/worker/review-queue.worker';

const repo = { id: 'r1', owner: 'acme', name: 'api', baselineShas: ['old'] };
const pr = (over: Record<string, unknown> = {}) => ({ number: 7, title: 'Add login', url: 'https://github.com/acme/api/pull/7', headSha: 'abc', isDraft: false, authorIsBot: false, ...over });

function setup(created = true) {
  const createQueued = vi.fn().mockResolvedValue({ review: { id: 'v1' }, created });
  const enqueue = vi.fn();
  const service = new ReviewsService({ createQueued } as unknown as ReviewsRepository, { enqueue } as unknown as ReviewQueueWorker);
  return { service, createQueued, enqueue };
}

describe('ReviewsService.queueReview', () => {
  it('records the review and queues it', async () => {
    const { service, createQueued, enqueue } = setup();
    expect(await service.queueReview(repo, pr())).toBe(true);
    expect(createQueued).toHaveBeenCalledWith({ repositoryId: 'r1', prNumber: 7, prTitle: 'Add login', prUrl: 'https://github.com/acme/api/pull/7', headSha: 'abc' });
    expect(enqueue).toHaveBeenCalledWith('v1');
  });

  it('queues nothing for a commit that already has a review (a webhook and the poller can both see it)', async () => {
    const { service, enqueue } = setup(false);
    expect(await service.queueReview(repo, pr())).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ['a draft', { isDraft: true }],
    ['a bot', { authorIsBot: true }],
    ['a commit that was open when the repository was added', { headSha: 'old' }],
  ])('does not even record %s', async (_name, over) => {
    const { service, createQueued, enqueue } = setup();
    expect(await service.queueReview(repo, pr(over))).toBe(false);
    expect(createQueued).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
