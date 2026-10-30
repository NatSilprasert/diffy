import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { ReposService } from '../src/module/repos/repos.service';

const service = (found: unknown) =>
  new ReposService({ findActiveById: vi.fn().mockResolvedValue(found) } as unknown as ReposRepository);

describe('ReposService.getActiveRepo', () => {
  it('returns only what other modules need: identity and baseline', async () => {
    const found = { id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'], enabled: true, removedAt: null };
    expect(await service(found).getActiveRepo('r1')).toEqual({ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'] });
  });

  it('is a 404 for an unknown or removed repository', async () => {
    await expect(service(null).getActiveRepo('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReposService polling helpers', () => {
  it('listWatchedRepos returns identity and baseline only', async () => {
    const findPollable = vi.fn().mockResolvedValue([{ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'], enabled: true, removedAt: null }]);
    const service = new ReposService({ findPollable } as unknown as ReposRepository);
    expect(await service.listWatchedRepos()).toEqual([{ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'] }]);
  });

});

describe('ReposService.getFullNames', () => {
  it('maps ids to owner/name and does not query for an empty list', async () => {
    const findNamesByIds = vi.fn().mockResolvedValue([{ id: 'r1', owner: 'acme', name: 'api' }]);
    const service = new ReposService({ findNamesByIds } as unknown as ReposRepository);
    expect(await service.getFullNames([])).toEqual(new Map());
    expect(findNamesByIds).not.toHaveBeenCalled();
    expect(await service.getFullNames(['r1', 'x'])).toEqual(new Map([['r1', 'acme/api']]));
  });
});

describe('ReposService.findWatchedRepo', () => {
  it('returns the watched repository by name, with identity and baseline only', async () => {
    const findWatchedByName = vi.fn().mockResolvedValue({ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'], enabled: true, removedAt: null });
    const service = new ReposService({ findWatchedByName } as unknown as ReposRepository);

    expect(await service.findWatchedRepo('Acme', 'API')).toEqual({ id: 'r1', owner: 'acme', name: 'api', baselineShas: ['s1'] });
    expect(findWatchedByName).toHaveBeenCalledWith('Acme', 'API');
  });

  it('is null when the repository is not watched', async () => {
    const service = new ReposService({ findWatchedByName: vi.fn().mockResolvedValue(null) } as unknown as ReposRepository);
    expect(await service.findWatchedRepo('acme', 'api')).toBeNull();
  });
});
