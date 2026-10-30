import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ getPullRequest: vi.fn() }));

import { getPullRequest } from '@diffy/core';
import { CreateReviewRequestSchema } from '../src/module/reviews/dto/create-review.dto';
import type { ReposService } from '../src/module/repos/repos.service';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { CreateReviewUsecase } from '../src/module/reviews/usecase/create-review.usecase';
import type { GithubService } from '../src/module/github/github.service';
import type { ReviewQueueWorker } from '../src/module/reviews/worker/review-queue.worker';

const createQueued = vi.fn();
const getAccountRepo = vi.fn();
const getAccess = vi.fn();
const enqueue = vi.fn();
const usecase = new CreateReviewUsecase(
  { createQueued } as unknown as ReviewsRepository,
  { getAccountRepo } as unknown as ReposService,
  { getAccess } as unknown as GithubService,
  { enqueue } as unknown as ReviewQueueWorker,
);

const pr = { owner: 'acme', repo: 'api', number: 7, title: 'Add login', url: 'https://github.com/acme/api/pull/7', headSha: 'abc1234' };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  repositoryId: 'r1',
  prNumber: 7,
  prTitle: 'Add login',
  prUrl: pr.url,
  headSha: 'abc1234',
  status: 'queued',
  error: null,
  githubReviewUrl: null,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
  finishedAt: null,
  ...over,
});

beforeEach(() => {
  createQueued.mockReset();
  enqueue.mockReset();
  getAccountRepo.mockReset().mockResolvedValue({ id: 'r1', accountId: 'acc1', owner: 'acme', name: 'api' });
  getAccess.mockReset().mockResolvedValue({ octokit: {}, secrets: [] });
  vi.mocked(getPullRequest).mockReset().mockResolvedValue(pr as never);
});

describe('CreateReviewUsecase', () => {
  it('looks for the repository inside the account of the person, so another account\'s repository is not found', async () => {
    createQueued.mockResolvedValue({ review: row(), created: true });
    await usecase.execute('acc1', { repositoryId: 'r1', prNumber: 7 });
    expect(getAccountRepo).toHaveBeenCalledWith('r1', 'acc1');
  });

  it('queues a review for the PR\'s current head commit', async () => {
    createQueued.mockResolvedValue({ review: row(), created: true });

    const result = await usecase.execute('acc1', { repositoryId: 'r1', prNumber: 7 });

    expect(vi.mocked(getPullRequest).mock.calls[0]!.slice(1)).toEqual(['acme', 'api', 7]);
    expect(createQueued).toHaveBeenCalledWith({
      repositoryId: 'r1',
      prNumber: 7,
      prTitle: 'Add login',
      prUrl: pr.url,
      headSha: 'abc1234',
    });
    expect(result.skipped).toBe(false);
    expect(enqueue).toHaveBeenCalledWith('v1');
    expect(result.review).toMatchObject({ id: 'v1', status: 'queued', headSha: 'abc1234', createdAt: '2026-10-24T01:02:03.000Z' });
  });

  it('reports skipped: true and returns the existing review when this commit was already reviewed', async () => {
    createQueued.mockResolvedValue({ review: row({ id: 'old', status: 'posted' }), created: false });

    const result = await usecase.execute('acc1', { repositoryId: 'r1', prNumber: 7 });

    expect(result.skipped).toBe(true);
    expect(result.review).toMatchObject({ id: 'old', status: 'posted' });
    expect(enqueue).not.toHaveBeenCalled(); // already queued, running or finished
  });

  it('returns 404 for an unknown or removed repository, without calling GitHub', async () => {
    getAccountRepo.mockRejectedValue(new NotFoundException('Repository not found.'));
    await expect(usecase.execute('acc1', { repositoryId: 'nope', prNumber: 7 })).rejects.toBeInstanceOf(NotFoundException);
    expect(getPullRequest).not.toHaveBeenCalled();
    expect(createQueued).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns 404 when GitHub has no such pull request, and queues nothing', async () => {
    vi.mocked(getPullRequest).mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    await expect(usecase.execute('acc1', { repositoryId: 'r1', prNumber: 999 })).rejects.toThrow(/Pull request #999 was not found/);
    expect(createQueued).not.toHaveBeenCalled();
  });

  it('maps a rejected token to 400 and a network failure to 502', async () => {
    vi.mocked(getPullRequest).mockRejectedValueOnce(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(usecase.execute('acc1', { repositoryId: 'r1', prNumber: 7 })).rejects.toBeInstanceOf(BadRequestException);

    vi.mocked(getPullRequest).mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(usecase.execute('acc1', { repositoryId: 'r1', prNumber: 7 })).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('does not call GitHub when no token is saved', async () => {
    getAccess.mockRejectedValue(new BadRequestException('Connect your GitHub token in Settings first.'));
    await expect(usecase.execute('acc1', { repositoryId: 'r1', prNumber: 7 })).rejects.toThrow(/Connect your GitHub token/);
    expect(getPullRequest).not.toHaveBeenCalled();
  });
});

describe('CreateReviewRequestSchema', () => {
  it('accepts a repository id and a positive integer PR number', () => {
    expect(CreateReviewRequestSchema.safeParse({ repositoryId: 'r1', prNumber: 7 }).success).toBe(true);
  });

  it.each([{}, { repositoryId: 'r1' }, { prNumber: 7 }, { repositoryId: '', prNumber: 7 }, { repositoryId: 'r1', prNumber: 0 }, { repositoryId: 'r1', prNumber: -1 }, { repositoryId: 'r1', prNumber: 1.5 }, { repositoryId: 'r1', prNumber: '7' }])(
    'rejects %j',
    (body) => {
      expect(CreateReviewRequestSchema.safeParse(body).success).toBe(false);
    },
  );
});
