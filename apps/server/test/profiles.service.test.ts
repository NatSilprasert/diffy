import { describe, expect, it, vi } from 'vitest';
import type { ProfilesRepository } from '../src/module/profiles/profiles.repository';
import { ProfilesService } from '../src/module/profiles/profiles.service';
import type { ProfileBuilderWorker } from '../src/module/profiles/worker/profile-builder.worker';
import type { ProfileFreshnessWorker } from '../src/module/profiles/worker/profile-freshness.worker';
import type { SettingsService } from '../src/module/settings/settings.service';

const watched = (id: string, accountId = 'acc1') => ({ id, accountId, owner: 'acme', name: id, baselineShas: [] as string[] });

function setup(over: { row?: Record<string, unknown> | null; configured?: boolean; have?: string[]; created?: boolean | boolean[] } = {}) {
  const created = [over.created ?? true].flat();
  const repository = {
    findByRepositoryId: vi.fn().mockResolvedValue(over.row ?? null),
    findRepositoryIdsWithProfile: vi.fn().mockResolvedValue(over.have ?? []),
    createBuilding: vi.fn().mockImplementation(async () => created.shift() ?? true),
  };
  const enqueue = vi.fn();
  const isLlmConfigured = vi.fn().mockResolvedValue(over.configured ?? true);
  const checkAll = vi.fn().mockResolvedValue(undefined);
  const service = new ProfilesService(
    repository as unknown as ProfilesRepository,
    { enqueue } as unknown as ProfileBuilderWorker,
    { isLlmConfigured } as unknown as SettingsService,
    { checkAll } as unknown as ProfileFreshnessWorker,
  );
  return { service, repository, enqueue, isLlmConfigured, checkAll };
}

describe('ProfilesService.getReviewContext', () => {
  it('gives the profile and the notes, trimmed', async () => {
    const { service } = setup({ row: { content: '\n## Overview\n', notes: '  Money is in satang. ' } });
    expect(await service.getReviewContext('r1')).toEqual({ profile: '## Overview', notes: 'Money is in satang.' });
  });

  it('has nothing for a repository without a profile, and nothing for empty text', async () => {
    expect(await setup().service.getReviewContext('r1')).toEqual({ profile: undefined, notes: undefined });
    expect(await setup({ row: { content: null, notes: '   ' } }).service.getReviewContext('r1')).toEqual({ profile: undefined, notes: undefined });
  });

  it('keeps using the old content of a profile whose rebuild failed', async () => {
    const { service } = setup({ row: { status: 'failed', content: 'Old but good.', notes: '' } });
    expect((await service.getReviewContext('r1')).profile).toBe('Old but good.');
  });
});

describe('ProfilesService.startMissing', () => {
  it('starts a build for each repository without a profile, and only those', async () => {
    const { service, repository, enqueue } = setup({ have: ['r2'] });
    await service.startMissing([watched('r1'), watched('r2'), watched('r3')]);
    expect(repository.createBuilding.mock.calls.map(([id]) => id)).toEqual(['r1', 'r3']);
    expect(enqueue.mock.calls.map(([id]) => id)).toEqual(['r1', 'r3']);
  });

  it('does not build one that another caller created a moment earlier', async () => {
    const { service, enqueue } = setup({ created: [false, true] });
    await service.startMissing([watched('r1'), watched('r2')]);
    expect(enqueue.mock.calls.map(([id]) => id)).toEqual(['r2']);
  });

  it('waits until the account has set up its model, without touching the database', async () => {
    const { service, repository, enqueue } = setup({ configured: false });
    await service.startMissing([watched('r1')]);
    expect(repository.findRepositoryIdsWithProfile).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('does nothing for no repositories', async () => {
    const { service, isLlmConfigured } = setup();
    await service.startMissing([]);
    expect(isLlmConfigured).not.toHaveBeenCalled();
  });
});

describe('ProfilesService.refreshStale', () => {
  it('hands the repositories to the freshness check', async () => {
    const { service, checkAll } = setup();
    await service.refreshStale([watched('r1'), watched('r2')]);
    expect(checkAll).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('does nothing before the account has set up its model, or without repositories', async () => {
    const notReady = setup({ configured: false });
    await notReady.service.refreshStale([watched('r1')]);
    const none = setup();
    await none.service.refreshStale([]);
    expect(notReady.checkAll).not.toHaveBeenCalled();
    expect(none.checkAll).not.toHaveBeenCalled();
  });
});

describe('ProfilesService with several accounts', () => {
  it('asks each account once, and works only for the repositories of an account with a model', async () => {
    const { service, isLlmConfigured, enqueue } = setup();
    isLlmConfigured.mockImplementation(async (accountId: string) => accountId === 'ready');

    await service.startMissing([watched('r1', 'ready'), watched('r2', 'waiting'), watched('r3', 'ready')]);

    expect(isLlmConfigured.mock.calls.map(([accountId]) => accountId)).toEqual(['ready', 'waiting']);
    expect(enqueue.mock.calls.map(([id]) => id)).toEqual(['r1', 'r3']);
  });

  it('checks freshness only for repositories of an account with a model', async () => {
    const { service, isLlmConfigured, checkAll } = setup();
    isLlmConfigured.mockImplementation(async (accountId: string) => accountId === 'ready');
    await service.refreshStale([watched('r1', 'waiting'), watched('r2', 'ready')]);
    expect(checkAll).toHaveBeenCalledWith(['r2']);
  });
});
