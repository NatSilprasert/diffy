import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ createGithubClient: vi.fn(() => ({ client: true })), buildProjectProfile: vi.fn() }));

import { buildProjectProfile } from '@diffy/core';
import type { ProfilesRepository } from '../src/module/profiles/profiles.repository';
import { ProfileBuilderService } from '../src/module/profiles/worker/profile-builder.service';
import type { ReposService } from '../src/module/repos/repos.service';
import type { SettingsService } from '../src/module/settings/settings.service';

const findByRepositoryId = vi.fn();
const findBuildingRepositoryIds = vi.fn();
const saveBuilt = vi.fn();
const markFailed = vi.fn();
const getActiveRepo = vi.fn();
const getGithubToken = vi.fn();
const getLlmConfig = vi.fn();

const builder = () =>
  new ProfileBuilderService(
    { findByRepositoryId, findBuildingRepositoryIds, saveBuilt, markFailed } as unknown as ProfilesRepository,
    { getActiveRepo } as unknown as ReposService,
    { getGithubToken, getLlmConfig } as unknown as SettingsService,
  );

const llm = { provider: 'google', model: 'gemini-x', apiKey: 'AIza-REALSECRET' };
const built = { content: '## Overview', branch: 'main', commit: 'abc123', usage: { inputTokens: 900, outputTokens: 300 }, filesRead: ['README.md'], dropped: 1 };

beforeEach(() => {
  for (const fn of [findByRepositoryId, findBuildingRepositoryIds, saveBuilt, markFailed, getActiveRepo, getGithubToken, getLlmConfig]) fn.mockReset();
  vi.mocked(buildProjectProfile).mockReset().mockResolvedValue(built as never);
  findByRepositoryId.mockResolvedValue({ status: 'building' });
  findBuildingRepositoryIds.mockResolvedValue([]);
  saveBuilt.mockResolvedValue(undefined);
  markFailed.mockResolvedValue(undefined);
  getActiveRepo.mockResolvedValue({ id: 'r1', owner: 'acme', name: 'shop', baselineShas: [] });
  getGithubToken.mockResolvedValue('github_pat_REALTOKEN');
  getLlmConfig.mockResolvedValue(llm);
});

describe('ProfileBuilderService.run', () => {
  it('builds the profile of the repository and saves it with the model that wrote it', async () => {
    await builder().run('r1');

    const input = vi.mocked(buildProjectProfile).mock.calls[0]![0];
    expect(input).toMatchObject({ owner: 'acme', repo: 'shop', llm });
    expect(saveBuilt).toHaveBeenCalledWith('r1', {
      content: '## Overview',
      branch: 'main',
      builtCommit: 'abc123',
      provider: 'google',
      model: 'gemini-x',
      inputTokens: 900,
      outputTokens: 300,
    });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('keeps missing token counts as null', async () => {
    vi.mocked(buildProjectProfile).mockResolvedValue({ ...built, usage: { inputTokens: undefined, outputTokens: undefined } } as never);
    await builder().run('r1');
    expect(saveBuilt.mock.calls[0]![1]).toMatchObject({ inputTokens: null, outputTokens: null });
  });

  it.each([null, { status: 'ready' }, { status: 'failed' }])('does nothing unless the profile is building (%j)', async (row) => {
    findByRepositoryId.mockResolvedValue(row);
    await builder().run('r1');
    expect(buildProjectProfile).not.toHaveBeenCalled();
    expect(saveBuilt).not.toHaveBeenCalled();
  });

  it('records a failure on the profile instead of throwing, with both secrets removed', async () => {
    vi.mocked(buildProjectProfile).mockRejectedValue(new Error('LLM call failed (google/gemini-x): bad key AIza-REALSECRET and token github_pat_REALTOKEN were rejected'));
    await expect(builder().run('r1')).resolves.toBeUndefined();
    const [id, message] = markFailed.mock.calls[0]!;
    expect(id).toBe('r1');
    expect(message).toContain('LLM call failed');
    expect(message).not.toContain('AIza-REALSECRET');
    expect(message).not.toContain('github_pat_REALTOKEN');
  });

  it('records settings that are not complete as a failure the person can read', async () => {
    getLlmConfig.mockRejectedValue(new Error('Save an LLM provider, model and API key in Settings first.'));
    await builder().run('r1');
    expect(markFailed).toHaveBeenCalledWith('r1', 'Save an LLM provider, model and API key in Settings first.');
    expect(buildProjectProfile).not.toHaveBeenCalled();
  });

  it('records a repository that was removed meanwhile', async () => {
    getActiveRepo.mockRejectedValue(new Error('Repository not found.'));
    await builder().run('r1');
    expect(markFailed).toHaveBeenCalledWith('r1', 'Repository not found.');
  });

  it('truncates a very long error', async () => {
    vi.mocked(buildProjectProfile).mockRejectedValue(new Error('x'.repeat(5_000)));
    await builder().run('r1');
    expect(markFailed.mock.calls[0]![1]).toHaveLength(2_000);
  });

  it('survives a failure to record the failure', async () => {
    vi.mocked(buildProjectProfile).mockRejectedValue(new Error('boom'));
    markFailed.mockRejectedValue(new Error('database is down'));
    await expect(builder().run('r1')).resolves.toBeUndefined();
  });
});

describe('ProfileBuilderService queue', () => {
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  it('builds one profile at a time, in the order they were queued', async () => {
    const order: string[] = [];
    let finishFirst!: () => void;
    vi.mocked(buildProjectProfile).mockImplementation(async ({ repo }) => {
      order.push(`start ${repo}`);
      if (repo === 'a') await new Promise<void>((resolve) => (finishFirst = resolve));
      order.push(`end ${repo}`);
      return built as never;
    });
    getActiveRepo.mockImplementation(async (id: string) => ({ id, owner: 'acme', name: id, baselineShas: [] }));

    const b = builder();
    b.enqueue('a');
    b.enqueue('b');
    await settle();
    expect(order).toEqual(['start a']);

    finishFirst();
    await settle();
    await settle();
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('does not queue a repository twice while it waits', async () => {
    let release!: () => void;
    vi.mocked(buildProjectProfile).mockImplementation(() => new Promise((resolve) => (release = () => resolve(built as never))));
    getActiveRepo.mockImplementation(async (id: string) => ({ id, owner: 'acme', name: id, baselineShas: [] }));

    const b = builder();
    b.enqueue('a');
    b.enqueue('b');
    b.enqueue('b');
    await settle();
    release();
    await settle();
    await settle();
    release();
    await settle();
    expect(vi.mocked(buildProjectProfile).mock.calls.map(([input]) => input.repo)).toEqual(['a', 'b']);
  });

  it('starts again the builds that were unfinished when the server stopped', async () => {
    findBuildingRepositoryIds.mockResolvedValue(['r1']);
    await builder().onApplicationBootstrap();
    await settle();
    expect(buildProjectProfile).toHaveBeenCalledTimes(1);
  });
});
