import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ProfilesRepository } from '../src/module/profiles/profiles.repository';
import { GetProfileUsecase } from '../src/module/profiles/usecase/get-profile.usecase';
import { RebuildProfileUsecase } from '../src/module/profiles/usecase/rebuild-profile.usecase';
import { UpdateProfileNotesUsecase } from '../src/module/profiles/usecase/update-profile-notes.usecase';
import type { ProfileBuilderWorker } from '../src/module/profiles/worker/profile-builder.worker';
import type { ReposService } from '../src/module/repos/repos.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  repositoryId: 'r1',
  status: 'ready',
  content: '## Overview',
  notes: 'Money is in satang.',
  error: null,
  branch: 'main',
  builtCommit: 'abc123',
  builtAt: new Date('2026-10-26T01:02:03.000Z'),
  provider: 'google',
  model: 'gemini-x',
  inputTokens: 900,
  outputTokens: 300,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const reposService = (exists = true) => ({
  getActiveRepo: vi.fn(async () => {
    if (!exists) throw new NotFoundException('Repository not found.');
    return { id: 'r1' };
  }),
});

describe('GetProfileUsecase', () => {
  it('returns the profile as the API shows it, with the time as ISO text', async () => {
    const usecase = new GetProfileUsecase({ findByRepositoryId: vi.fn().mockResolvedValue(row()) } as unknown as ProfilesRepository, reposService() as unknown as ReposService);
    expect(await usecase.execute({ repositoryId: 'r1' })).toEqual({
      repositoryId: 'r1',
      status: 'ready',
      content: '## Overview',
      notes: 'Money is in satang.',
      error: null,
      branch: 'main',
      builtCommit: 'abc123',
      builtAt: '2026-10-26T01:02:03.000Z',
      provider: 'google',
      model: 'gemini-x',
      inputTokens: 900,
      outputTokens: 300,
    });
  });

  it('is a 404 for a repository without a profile yet, and for an unknown repository', async () => {
    const none = new GetProfileUsecase({ findByRepositoryId: vi.fn().mockResolvedValue(null) } as unknown as ProfilesRepository, reposService() as unknown as ReposService);
    await expect(none.execute({ repositoryId: 'r1' })).rejects.toBeInstanceOf(NotFoundException);

    const findByRepositoryId = vi.fn();
    const unknown = new GetProfileUsecase({ findByRepositoryId } as unknown as ProfilesRepository, reposService(false) as unknown as ReposService);
    await expect(unknown.execute({ repositoryId: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(findByRepositoryId).not.toHaveBeenCalled();
  });
});

describe('UpdateProfileNotesUsecase', () => {
  const setup = (updated: boolean) => {
    const repository = { updateNotes: vi.fn().mockResolvedValue(updated), findByRepositoryId: vi.fn().mockResolvedValue(row({ notes: 'New.' })) };
    return { repository, usecase: new UpdateProfileNotesUsecase(repository as unknown as ProfilesRepository, reposService() as unknown as ReposService) };
  };

  it('saves the notes trimmed and returns the profile', async () => {
    const { usecase, repository } = setup(true);
    expect((await usecase.execute({ repositoryId: 'r1' }, { notes: '  New.\n' })).notes).toBe('New.');
    expect(repository.updateNotes).toHaveBeenCalledWith('r1', 'New.');
  });

  it('is a 409 when there is no profile to keep the notes in', async () => {
    await expect(setup(false).usecase.execute({ repositoryId: 'r1' }, { notes: 'x' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RebuildProfileUsecase', () => {
  const setup = (over: { created?: boolean; idle?: boolean; exists?: boolean } = {}) => {
    const repository = {
      createBuilding: vi.fn().mockResolvedValue(over.created ?? false),
      markBuildingIfIdle: vi.fn().mockResolvedValue(over.idle ?? true),
      findByRepositoryId: vi.fn().mockResolvedValue(row({ status: 'building' })),
    };
    const enqueue = vi.fn();
    const usecase = new RebuildProfileUsecase(repository as unknown as ProfilesRepository, reposService(over.exists ?? true) as unknown as ReposService, { enqueue } as unknown as ProfileBuilderWorker);
    return { usecase, repository, enqueue };
  };

  it('puts an existing profile back to building and queues the build', async () => {
    const { usecase, enqueue } = setup();
    expect((await usecase.execute({ repositoryId: 'r1' })).status).toBe('building');
    expect(enqueue).toHaveBeenCalledWith('r1');
  });

  it('starts the first build when there is no profile yet, without touching an existing one', async () => {
    const { usecase, repository, enqueue } = setup({ created: true });
    await usecase.execute({ repositoryId: 'r1' });
    expect(repository.markBuildingIfIdle).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith('r1');
  });

  it('is a 409, and queues nothing, when it is already building', async () => {
    const { usecase, enqueue } = setup({ idle: false });
    await expect(usecase.execute({ repositoryId: 'r1' })).rejects.toBeInstanceOf(ConflictException);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('is a 404 for an unknown repository, and touches nothing', async () => {
    const { usecase, repository, enqueue } = setup({ exists: false });
    await expect(usecase.execute({ repositoryId: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createBuilding).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
