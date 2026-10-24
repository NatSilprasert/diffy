import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ createGithubClient: vi.fn(() => ({ client: true })), listOpenPullRequests: vi.fn() }));

import { createGithubClient, listOpenPullRequests } from '@diffy/core';
import type { Env } from '../src/infra/config/env';
import type { ReposService } from '../src/module/repos/repos.service';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { PollerService } from '../src/module/reviews/worker/poller.service';
import type { ReviewQueueService } from '../src/module/reviews/worker/review-queue.service';
import type { SettingsService } from '../src/module/settings/settings.service';

const listPollableRepos = vi.fn();
const recordPoll = vi.fn();
const getGithubToken = vi.fn();
const createQueued = vi.fn();
const enqueue = vi.fn();

const poller = () =>
  new PollerService(
    { POLL_INTERVAL_SECONDS: 60 } as Env,
    { listPollableRepos, recordPoll } as unknown as ReposService,
    { getGithubToken } as unknown as SettingsService,
    { createQueued } as unknown as ReviewsRepository,
    { enqueue } as unknown as ReviewQueueService,
  );

const repo = { id: 'r1', owner: 'acme', name: 'api' };
const pr = (number: number, over: Record<string, unknown> = {}) => ({
  owner: 'acme',
  repo: 'api',
  number,
  title: `PR ${number}`,
  body: '',
  url: `https://github.com/acme/api/pull/${number}`,
  headSha: `sha${number}`,
  isDraft: false,
  authorLogin: 'dev',
  authorIsBot: false,
  ...over,
});

beforeEach(() => {
  for (const fn of [listPollableRepos, recordPoll, getGithubToken, createQueued, enqueue]) fn.mockReset();
  vi.mocked(listOpenPullRequests).mockReset().mockResolvedValue([]);
  vi.mocked(createGithubClient).mockClear();
  getGithubToken.mockResolvedValue('github_pat_x');
  recordPoll.mockResolvedValue(undefined);
  createQueued.mockImplementation(async (data: { prNumber: number }) => ({ review: { id: `v${data.prNumber}` }, created: true }));
});

afterEach(() => vi.useRealTimers());

describe('PollerService.pollRepo', () => {
  it('queues a review for every new pull request and records a clean poll', async () => {
    vi.mocked(listOpenPullRequests).mockResolvedValue([pr(1), pr(2)] as never);

    expect(await poller().pollRepo(repo)).toBe(2);

    expect(createGithubClient).toHaveBeenCalledWith('github_pat_x');
    expect(vi.mocked(listOpenPullRequests).mock.calls[0]!.slice(1)).toEqual(['acme', 'api']);
    expect(createQueued).toHaveBeenCalledWith({ repositoryId: 'r1', prNumber: 1, prTitle: 'PR 1', prUrl: pr(1).url, headSha: 'sha1' });
    expect(enqueue.mock.calls.map((c) => c[0])).toEqual(['v1', 'v2']);
    expect(recordPoll).toHaveBeenCalledWith('r1', null);
  });

  it('does not queue a commit that already has a review (created: false)', async () => {
    vi.mocked(listOpenPullRequests).mockResolvedValue([pr(1), pr(2)] as never);
    createQueued.mockImplementation(async (data: { prNumber: number }) => ({ review: { id: `v${data.prNumber}` }, created: data.prNumber === 2 }));

    expect(await poller().pollRepo(repo)).toBe(1);
    expect(enqueue.mock.calls.map((c) => c[0])).toEqual(['v2']);
  });

  it('skips draft pull requests and bots', async () => {
    vi.mocked(listOpenPullRequests).mockResolvedValue([
      pr(1, { isDraft: true }),
      pr(2, { authorIsBot: true, authorLogin: 'dependabot[bot]' }),
      pr(3),
    ] as never);

    expect(await poller().pollRepo(repo)).toBe(1);
    expect(createQueued).toHaveBeenCalledTimes(1);
    expect(createQueued).toHaveBeenCalledWith(expect.objectContaining({ prNumber: 3 }));
  });

  it('records the error on the repository instead of throwing when GitHub fails', async () => {
    vi.mocked(listOpenPullRequests).mockRejectedValue(new Error('Not Found - https://docs.github.com/rest'));

    await expect(poller().pollRepo(repo)).resolves.toBe(0);

    expect(recordPoll).toHaveBeenCalledWith('r1', 'Not Found - https://docs.github.com/rest');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('records a missing or undecryptable token the same way, without calling GitHub', async () => {
    getGithubToken.mockRejectedValue(new Error('Connect your GitHub token in Settings first.'));

    await expect(poller().pollRepo(repo)).resolves.toBe(0);

    expect(listOpenPullRequests).not.toHaveBeenCalled();
    expect(recordPoll).toHaveBeenCalledWith('r1', 'Connect your GitHub token in Settings first.');
  });

  it('truncates a very long error', async () => {
    vi.mocked(listOpenPullRequests).mockRejectedValue(new Error('x'.repeat(2_000)));
    await poller().pollRepo(repo);
    expect((recordPoll.mock.calls[0]![1] as string).length).toBe(500);
  });

  it('does not record a clean poll when saving a review failed half way', async () => {
    vi.mocked(listOpenPullRequests).mockResolvedValue([pr(1)] as never);
    createQueued.mockRejectedValue(new Error('database is down'));

    await poller().pollRepo(repo);

    expect(recordPoll).toHaveBeenCalledWith('r1', 'database is down');
    expect(recordPoll).not.toHaveBeenCalledWith('r1', null);
  });
});

describe('PollerService.pollAll', () => {
  it('polls every pollable repository, and one failing repository does not stop the others', async () => {
    listPollableRepos.mockResolvedValue([repo, { id: 'r2', owner: 'acme', name: 'web' }, { id: 'r3', owner: 'acme', name: 'docs' }]);
    vi.mocked(listOpenPullRequests)
      .mockResolvedValueOnce([pr(1)] as never)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([pr(3)] as never);

    await poller().pollAll();

    expect(listOpenPullRequests).toHaveBeenCalledTimes(3);
    expect(recordPoll.mock.calls).toEqual([['r1', null], ['r2', 'boom'], ['r3', null]]);
  });

  it('survives a failure while recording a poll', async () => {
    listPollableRepos.mockResolvedValue([repo, { id: 'r2', owner: 'acme', name: 'web' }]);
    recordPoll.mockRejectedValueOnce(new Error('database is down')).mockResolvedValue(undefined);

    await expect(poller().pollAll()).resolves.toBeUndefined();
    expect(listOpenPullRequests).toHaveBeenCalledTimes(2);
  });

  it('survives a failure while listing the repositories', async () => {
    listPollableRepos.mockRejectedValue(new Error('database is down'));
    await expect(poller().pollAll()).resolves.toBeUndefined();
  });

  it('does nothing when no repository is being watched', async () => {
    listPollableRepos.mockResolvedValue([]);
    await poller().pollAll();
    expect(getGithubToken).not.toHaveBeenCalled();
  });

  it('does not start a second pass while one is still running', async () => {
    listPollableRepos.mockResolvedValue([repo]);
    let release!: () => void;
    vi.mocked(listOpenPullRequests).mockImplementation(() => new Promise((resolve) => (release = () => resolve([]))));

    const p = poller();
    const first = p.pollAll();
    await new Promise((resolve) => setImmediate(resolve));
    await p.pollAll(); // returns at once: a pass is already running
    expect(listPollableRepos).toHaveBeenCalledTimes(1);

    release();
    await first;
    vi.mocked(listOpenPullRequests).mockResolvedValue([]); // the next pass answers at once
    await p.pollAll(); // allowed again afterwards
    expect(listPollableRepos).toHaveBeenCalledTimes(2);
  });
});

describe('PollerService timer', () => {
  it('polls once at startup and then every POLL_INTERVAL_SECONDS, until the module is destroyed', async () => {
    vi.useFakeTimers();
    listPollableRepos.mockResolvedValue([]);
    const p = poller();

    p.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(listPollableRepos).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(listPollableRepos).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(listPollableRepos).toHaveBeenCalledTimes(4);

    p.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(listPollableRepos).toHaveBeenCalledTimes(4);
  });
});
