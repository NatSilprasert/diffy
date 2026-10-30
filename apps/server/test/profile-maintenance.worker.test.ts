import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfilesService } from '../src/module/profiles/profiles.service';
import { MAINTAIN_EVERY_MS, ProfileMaintenanceWorker } from '../src/module/profiles/worker/profile-maintenance.worker';
import type { ReposService } from '../src/module/repos/repos.service';

const listWatchedRepos = vi.fn();
const startMissing = vi.fn();
const refreshStale = vi.fn();
const worker = () => new ProfileMaintenanceWorker({ listWatchedRepos } as unknown as ReposService, { startMissing, refreshStale } as unknown as ProfilesService);

const repos = [{ id: 'r1', accountId: 'acc1', owner: 'acme', name: 'api', baselineShas: [] }];

beforeEach(() => {
  vi.useFakeTimers();
  for (const fn of [listWatchedRepos, startMissing, refreshStale]) fn.mockReset().mockResolvedValue(undefined);
  listWatchedRepos.mockResolvedValue(repos);
});

afterEach(() => vi.useRealTimers());

describe('ProfileMaintenanceWorker', () => {
  it('starts the briefs that are missing and builds again the ones that went stale, for every watched repository', async () => {
    await worker().run();
    expect(startMissing).toHaveBeenCalledWith(repos);
    expect(refreshStale).toHaveBeenCalledWith(repos);
  });

  it('never throws: a failure is logged and the next pass goes on', async () => {
    startMissing.mockRejectedValueOnce(new Error('database is down'));
    const w = worker();
    await expect(w.run()).resolves.toBeUndefined();
    await w.run();
    expect(refreshStale).toHaveBeenCalledTimes(1); // the pass that failed stopped after startMissing; the next one did both
  });

  it('does not start a second pass while one is still running', async () => {
    let finish!: () => void;
    startMissing.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const w = worker();
    const first = w.run();
    await w.run();
    expect(listWatchedRepos).toHaveBeenCalledTimes(1);
    finish();
    await first;
  });

  it('runs at once when the server starts, then on the timer, and stops on shutdown', async () => {
    const w = worker();
    w.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(listWatchedRepos).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MAINTAIN_EVERY_MS);
    expect(listWatchedRepos).toHaveBeenCalledTimes(2);

    w.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(MAINTAIN_EVERY_MS * 3);
    expect(listWatchedRepos).toHaveBeenCalledTimes(2);
  });
});
