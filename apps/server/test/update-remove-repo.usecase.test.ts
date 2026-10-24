import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RemoveRepoParamsSchema } from '../src/module/repos/dto/remove-repo.dto';
import { UpdateRepoRequestSchema } from '../src/module/repos/dto/update-repo.dto';
import type { ReposRepository } from '../src/module/repos/repos.repository';
import { RemoveRepoUsecase } from '../src/module/repos/usecase/remove-repo.usecase';
import { UpdateRepoUsecase } from '../src/module/repos/usecase/update-repo.usecase';

const row = {
  id: 'r1',
  owner: 'acme',
  name: 'api',
  enabled: false,
  removedAt: null,
  lastPolledAt: null,
  lastError: null,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
};

describe('UpdateRepoUsecase', () => {
  it('pauses or resumes a repository and returns the item', async () => {
    const updateEnabled = vi.fn().mockResolvedValue(row);
    const result = await new UpdateRepoUsecase({ updateEnabled } as unknown as ReposRepository).execute(
      { id: 'r1' },
      { enabled: false },
    );
    expect(updateEnabled).toHaveBeenCalledWith('r1', false);
    expect(result).toMatchObject({ id: 'r1', fullName: 'acme/api', enabled: false });
    expect(result).not.toHaveProperty('removedAt');
  });

  it('returns 404 for an unknown or removed repository', async () => {
    const usecase = new UpdateRepoUsecase({ updateEnabled: vi.fn().mockResolvedValue(null) } as unknown as ReposRepository);
    await expect(usecase.execute({ id: 'nope' }, { enabled: true })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RemoveRepoUsecase', () => {
  it('removes the repository', async () => {
    const softRemove = vi.fn().mockResolvedValue(true);
    await expect(new RemoveRepoUsecase({ softRemove } as unknown as ReposRepository).execute({ id: 'r1' })).resolves.toBeUndefined();
    expect(softRemove).toHaveBeenCalledWith('r1');
  });

  it('returns 404 when there is nothing to remove (including a second delete)', async () => {
    const usecase = new RemoveRepoUsecase({ softRemove: vi.fn().mockResolvedValue(false) } as unknown as ReposRepository);
    await expect(usecase.execute({ id: 'r1' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('request schemas', () => {
  it('requires a boolean enabled', () => {
    expect(UpdateRepoRequestSchema.safeParse({ enabled: true }).success).toBe(true);
    for (const body of [{}, { enabled: 'yes' }, { enabled: 1 }, { enabled: null }]) {
      expect(UpdateRepoRequestSchema.safeParse(body).success).toBe(false);
    }
  });

  it('requires a non-empty id', () => {
    expect(RemoveRepoParamsSchema.safeParse({ id: 'abc' }).success).toBe(true);
    expect(RemoveRepoParamsSchema.safeParse({ id: '' }).success).toBe(false);
  });
});
