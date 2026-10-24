import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { ReposService } from '../src/module/repos/repos.service';

const service = (found: unknown) =>
  new ReposService({ findActiveById: vi.fn().mockResolvedValue(found) } as unknown as ReposRepository);

describe('ReposService.getActiveRepo', () => {
  it('returns only the identifying fields', async () => {
    const found = { id: 'r1', owner: 'acme', name: 'api', enabled: true, lastError: 'x', removedAt: null };
    expect(await service(found).getActiveRepo('r1')).toEqual({ id: 'r1', owner: 'acme', name: 'api' });
  });

  it('is a 404 for an unknown or removed repository', async () => {
    await expect(service(null).getActiveRepo('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
