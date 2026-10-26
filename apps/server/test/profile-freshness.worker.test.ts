import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ checkProfileFreshness: vi.fn(), createGithubClient: vi.fn(() => ({})) }));

import { checkProfileFreshness } from '@diffy/core';
import type { ProfilesRepository } from '../src/module/profiles/profiles.repository';
import { CHECK_EVERY_MS, ProfileFreshnessWorker } from '../src/module/profiles/worker/profile-freshness.worker';
import type { ProfileBuilderWorker } from '../src/module/profiles/worker/profile-builder.worker';
import type { ReposService } from '../src/module/repos/repos.service';
import type { SettingsService } from '../src/module/settings/settings.service';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const oldBuild = new Date(NOW - CHECK_EVERY_MS - 1000);
const readyRow = { status: 'ready', builtCommit: 'abc', branch: 'main', builtAt: oldBuild };

const findByRepositoryId = vi.fn();
const markBuildingIfIdle = vi.fn();
const getActiveRepo = vi.fn();
const getGithubToken = vi.fn();
const enqueue = vi.fn();

const worker = () =>
  new ProfileFreshnessWorker(
    { findByRepositoryId, markBuildingIfIdle } as unknown as ProfilesRepository,
    { getActiveRepo } as unknown as ReposService,
    { getGithubToken } as unknown as SettingsService,
    { enqueue } as unknown as ProfileBuilderWorker,
  );

beforeEach(() => {
  for (const fn of [findByRepositoryId, markBuildingIfIdle, getActiveRepo, getGithubToken, enqueue, vi.mocked(checkProfileFreshness)]) fn.mockReset();
  findByRepositoryId.mockResolvedValue(readyRow);
  markBuildingIfIdle.mockResolvedValue(true);
  getActiveRepo.mockResolvedValue({ owner: 'acme', name: 'api' });
  getGithubToken.mockResolvedValue('t');
});

describe('ProfileFreshnessWorker.checkAll', () => {
  it('builds a stale brief again, comparing against the commit it was built from', async () => {
    vi.mocked(checkProfileFreshness).mockResolvedValue({ stale: true, reason: 'AGENTS.md changed', head: 'def' });
    await worker().checkAll(['r1'], NOW);

    expect(vi.mocked(checkProfileFreshness).mock.calls[0]!.slice(1)).toEqual(['acme', 'api', 'main', 'abc']);
    expect(markBuildingIfIdle).toHaveBeenCalledWith('r1');
    expect(enqueue).toHaveBeenCalledWith('r1');
  });

  it('leaves a fresh brief alone', async () => {
    vi.mocked(checkProfileFreshness).mockResolvedValue({ stale: false, reason: undefined, head: 'abc' });
    await worker().checkAll(['r1'], NOW);
    expect(markBuildingIfIdle).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does not queue a second build when one is already running', async () => {
    vi.mocked(checkProfileFreshness).mockResolvedValue({ stale: true, reason: 'x', head: 'def' });
    markBuildingIfIdle.mockResolvedValue(false);
    await worker().checkAll(['r1'], NOW);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('looks at a repository at most once a day', async () => {
    vi.mocked(checkProfileFreshness).mockResolvedValue({ stale: false, reason: undefined, head: 'abc' });
    const w = worker();
    await w.checkAll(['r1'], NOW);
    await w.checkAll(['r1'], NOW + 60_000);
    expect(checkProfileFreshness).toHaveBeenCalledTimes(1);
    await w.checkAll(['r1'], NOW + CHECK_EVERY_MS);
    expect(checkProfileFreshness).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a brief built less than a day ago', { ...readyRow, builtAt: new Date(NOW - 1000) }],
    ['a brief being built', { ...readyRow, status: 'building' }],
    ['a brief that failed', { ...readyRow, status: 'failed' }],
    ['a brief without a commit', { ...readyRow, builtCommit: null }],
    ['a repository without a brief', null],
  ])('does not call GitHub for %s', async (_name, row) => {
    findByRepositoryId.mockResolvedValue(row);
    await worker().checkAll(['r1'], NOW);
    expect(checkProfileFreshness).not.toHaveBeenCalled();
  });

  it('goes on to the next repository when one cannot be checked, and checks it again next time', async () => {
    vi.mocked(checkProfileFreshness).mockRejectedValueOnce(new Error('rate limited')).mockResolvedValue({ stale: true, reason: 'x', head: 'd' });
    const w = worker();
    await w.checkAll(['r1', 'r2'], NOW);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('r2');

    await w.checkAll(['r1'], NOW + 60_000);
    expect(enqueue).toHaveBeenCalledWith('r1');
  });
});
