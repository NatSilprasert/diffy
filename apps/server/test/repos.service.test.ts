import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { ReposService } from '../src/module/repos/repos.service';

const service = (found: unknown) =>
  new ReposService({ findActiveById: vi.fn().mockResolvedValue(found) } as unknown as ReposRepository);

describe('ReposService.getActiveRepo', () => {
  it('returns only what other modules need: identity and baseline', async () => {
    const found = { id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'], enabled: true, lastError: 'x', removedAt: null };
    expect(await service(found).getActiveRepo('r1')).toEqual({ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'] });
  });

  it('is a 404 for an unknown or removed repository', async () => {
    await expect(service(null).getActiveRepo('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReposService polling helpers', () => {
  it('listPollableRepos returns identity and baseline only', async () => {
    const findPollable = vi.fn().mockResolvedValue([{ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'], enabled: true, lastError: 'x', removedAt: null }]);
    const service = new ReposService({ findPollable } as unknown as ReposRepository);
    expect(await service.listPollableRepos()).toEqual([{ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'] }]);
  });

  it('recordPoll passes the error (or null) to the repository', async () => {
    const markPolled = vi.fn().mockResolvedValue(undefined);
    const service = new ReposService({ markPolled } as unknown as ReposRepository);
    await service.recordPoll('r1', null);
    await service.recordPoll('r1', 'boom');
    expect(markPolled.mock.calls).toEqual([['r1', null], ['r1', 'boom']]);
  });
});
