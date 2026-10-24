import { describe, expect, it, vi } from 'vitest';
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

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('ReviewQueueService', () => {
  it('runs reviews one at a time, in the order they were queued', async () => {
    const c = controllableRun();
    const queue = new ReviewQueueService({ run: c.run } as unknown as RunReviewService);

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
    const queue = new ReviewQueueService({ run: c.run } as unknown as RunReviewService);

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
    const queue = new ReviewQueueService({ run } as unknown as RunReviewService);

    queue.enqueue('a');
    queue.enqueue('b');
    await queue.idle();

    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(queue.getState().current).toBeNull();
  });

  it('can be used again after it has gone idle', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const queue = new ReviewQueueService({ run } as unknown as RunReviewService);

    queue.enqueue('a');
    await queue.idle();
    queue.enqueue('b');
    await queue.idle();

    expect(run.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('picks up an id queued while another review is running', async () => {
    const c = controllableRun();
    const queue = new ReviewQueueService({ run: c.run } as unknown as RunReviewService);

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
    await expect(new ReviewQueueService({ run: vi.fn() } as unknown as RunReviewService).idle()).resolves.toBeUndefined();
  });
});
