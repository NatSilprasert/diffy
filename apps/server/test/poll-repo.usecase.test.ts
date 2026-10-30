import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PollRepoRequestSchema, PollRepoResponseSchema } from '../src/module/reviews/dto/poll-repo.dto';
import type { ReposService } from '../src/module/repos/repos.service';
import { PollRepoUsecase } from '../src/module/reviews/usecase/poll-repo.usecase';
import type { PollerWorker } from '../src/module/reviews/worker/poller.worker';

const repo = { id: 'r1', accountId: 'acc1', owner: 'acme', name: 'api', baselineShas: ['s1'] };

function setup(find: (id: string, accountId: string) => Promise<unknown>, pollRepo = vi.fn()) {
  const getAccountRepo = vi.fn(find);
  return { pollRepo, getAccountRepo, usecase: new PollRepoUsecase({ getAccountRepo } as unknown as ReposService, { pollRepo } as unknown as PollerWorker) };
}

describe('PollRepoUsecase', () => {
  it('polls the repository now and returns what the poll queued', async () => {
    const { usecase, pollRepo } = setup(async () => repo, vi.fn().mockResolvedValue({ queued: 2, error: null }));

    const result = await usecase.execute('acc1', { repositoryId: 'r1' });

    expect(pollRepo).toHaveBeenCalledWith(repo);
    expect(result).toEqual({ queued: 2, error: null });
    expect(PollRepoResponseSchema.safeParse(result).success).toBe(true);
  });

  it('returns a failed poll as a normal result, with the reason', async () => {
    const { usecase } = setup(async () => repo, vi.fn().mockResolvedValue({ queued: 0, error: 'Not Found' }));
    expect(await usecase.execute('acc1', { repositoryId: 'r1' })).toEqual({ queued: 0, error: 'Not Found' });
  });

  it('returns 404 for an unknown or removed repository, without polling', async () => {
    const { usecase, pollRepo } = setup(async () => {
      throw new NotFoundException('Repository not found.');
    });
    await expect(usecase.execute('acc1', { repositoryId: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(pollRepo).not.toHaveBeenCalled();
  });

  it('looks for the repository inside the account of the person, so another account\'s repository is not found', async () => {
    const { usecase, getAccountRepo } = setup(async () => repo, vi.fn().mockResolvedValue({ queued: 0, error: null }));
    await usecase.execute('acc1', { repositoryId: 'r1' });
    expect(getAccountRepo).toHaveBeenCalledWith('r1', 'acc1');
  });

  it('requires a non-empty repositoryId in the body', () => {
    expect(PollRepoRequestSchema.safeParse({ repositoryId: 'r1' }).success).toBe(true);
    for (const body of [{}, { repositoryId: '' }, { repositoryId: 5 }, { id: 'r1' }]) {
      expect(PollRepoRequestSchema.safeParse(body).success).toBe(false);
    }
  });
});
