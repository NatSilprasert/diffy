import { describe, expect, it, vi } from 'vitest';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import type { RunReviewService } from '../src/module/reviews/worker/run-review.service';
import { ReviewQueueService } from '../src/module/reviews/worker/review-queue.service';

// A run() whose completion the test controls, so overlapping behaviour can be observed.
function controllableRun() {
  const started: string[] = [];
  const releases: Array<() => void> = [];
  let active = 0;
  let maxActive = 0;
  const run = vi.fn(
    (id: string) =>
      new Promise<void>((resolve) => {
        started.push(id);
        active++;
        maxActive = Math.max(maxActive, active);
        releases.push(() => {
          active--;
          resolve();
        });
      }),
  );
  return { run, started, releases, maxActive: () => maxActive };
}

const noRepo = {} as unknown as ReviewsRepository; // only used by recovery, which these tests do not exercise

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('ReviewQueueService', () => {
  it('runs reviews one at a time, in the order they were queued', async () => {
    const c = controllableRun();
    const queue = new ReviewQueueService({ run: c.run } as unknown as RunReviewService, noRepo);

    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');
    await tick();
    expect(c.started).toEqual(['a']);
    expect(queue.getState()).toEqual({ queued: 2, current: 'a' });

    c.releases[0]!();
    await tick();
    expect(c.started).toEqual(['a', 'b']);

    c.releases[1]!();
    await tick();
    c.releases[2]!();
    await queue.idle();

    expect(c.started).toEqual(['a', 'b', 'c']);
    expect(c.maxActive()).toBe(1);
    expect(queue.getState()).toEqual({ queued: 0, current: null });
  });

  it('ignores an id that is already waiting or running', async () => {
    const c = controllableRun();
    const queue = new ReviewQueueService({ run: c.run } as unknown as RunReviewService, noRepo);

    queue.enqueue('a');
    queue.enqueue('a'); // running
    queue.enqueue('b');
    queue.enqueue('b'); // waiting
    await tick();
    expect(queue.getState().queued).toBe(1);

    c.releases[0]!();
    await tick();
    c.releases[1]!();
    await queue.idle();
    expect(c.run).toHaveBeenCalledTimes(2);
  });

  it('keeps going after a review crashes unexpectedly', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('database is down'))
      .mockResolvedValueOnce(undefined);
    const queue = new ReviewQueueService({ run } as unknown as RunReviewService, noRepo);

    queue.enqueue('a');
    queue.enqueue('b');
    await queue.idle();

    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(queue.getState().current).toBeNull();
  });

  it('can be used again after it has gone idle', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const queue = new ReviewQueueService({ run } as unknown as RunReviewService, noRepo);

    queue.enqueue('a');
    await queue.idle();
    queue.enqueue('b');
    await queue.idle();

    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('picks up an id queued while another review is running', async () => {
    const c = controllableRun();
    const queue = new ReviewQueueService({ run: c.run } as unknown as RunReviewService, noRepo);

    queue.enqueue('a');
    await tick();
    queue.enqueue('late');
    c.releases[0]!();
    await tick();
    c.releases[1]!();
    await queue.idle();

    expect(c.started).toEqual(['a', 'late']);
  });

  it('idle() resolves immediately when nothing was queued', async () => {
    await expect(new ReviewQueueService({ run: vi.fn() } as unknown as RunReviewService, noRepo).idle()).resolves.toBeUndefined();
  });
});

describe('ReviewQueueService.onApplicationBootstrap (recovery after a restart)', () => {
  it('queues every unfinished review from the database, oldest first', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const recoverUnfinished = vi.fn().mockResolvedValue(['old', 'newer', 'newest']);
    const queue = new ReviewQueueService({ run } as unknown as RunReviewService, { recoverUnfinished } as unknown as ReviewsRepository);

    await queue.onApplicationBootstrap();
    await queue.idle();

    expect(recoverUnfinished).toHaveBeenCalledTimes(1);
    expect(run.mock.calls.map((c) => c[0])).toEqual(['old', 'newer', 'newest']);
  });

  it('does nothing when no review was left unfinished', async () => {
    const run = vi.fn();
    const queue = new ReviewQueueService({ run } as unknown as RunReviewService, {
      recoverUnfinished: vi.fn().mockResolvedValue([]),
    } as unknown as ReviewsRepository);

    await queue.onApplicationBootstrap();
    await queue.idle();

    expect(run).not.toHaveBeenCalled();
  });

  it('does not stop the server from starting if recovery fails', async () => {
    const queue = new ReviewQueueService({ run: vi.fn() } as unknown as RunReviewService, {
      recoverUnfinished: vi.fn().mockRejectedValue(new Error('database is down')),
    } as unknown as ReviewsRepository);

    await expect(queue.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
