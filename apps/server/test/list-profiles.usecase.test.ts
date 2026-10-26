import { describe, expect, it, vi } from 'vitest';
import type { ProfilesRepository } from '../src/module/profiles/profiles.repository';
import { ListProfilesUsecase } from '../src/module/profiles/usecase/list-profiles.usecase';

describe('ListProfilesUsecase', () => {
  it('lists the status of every profile, with the build time as ISO text', async () => {
    const listStatuses = vi.fn().mockResolvedValue([
      { repositoryId: 'r1', status: 'ready', builtAt: new Date('2026-10-26T01:02:03.000Z') },
      { repositoryId: 'r2', status: 'building', builtAt: null },
    ]);
    const result = await new ListProfilesUsecase({ listStatuses } as unknown as ProfilesRepository).execute();
    expect(result).toEqual({
      profiles: [
        { repositoryId: 'r1', status: 'ready', builtAt: '2026-10-26T01:02:03.000Z' },
        { repositoryId: 'r2', status: 'building', builtAt: null },
      ],
    });
  });

  it('is an empty list when no repository has a profile', async () => {
    const usecase = new ListProfilesUsecase({ listStatuses: vi.fn().mockResolvedValue([]) } as unknown as ProfilesRepository);
    expect(await usecase.execute()).toEqual({ profiles: [] });
  });
});
