import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({
  createGithubClient: vi.fn(() => ({ client: true })),
  getPullRequest: vi.fn(),
  reviewPullRequest: vi.fn(),
}));

import { getPullRequest, reviewPullRequest } from '@diffy/core';
import type { Env } from '../src/infra/config/env';
import type { ProfilesService } from '../src/module/profiles/profiles.service';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { RunReviewWorker } from '../src/module/reviews/worker/run-review.worker';
import type { SettingsService } from '../src/module/settings/settings.service';

const findForRun = vi.fn();
const claim = vi.fn();
const saveResult = vi.fn();
const markFailed = vi.fn();
const getGithubToken = vi.fn();
const getLlmConfig = vi.fn();
const getReviewContext = vi.fn();

const service = new RunReviewWorker(
  { findForRun, claim, saveResult, markFailed } as unknown as ReviewsRepository,
  { getGithubToken, getLlmConfig } as unknown as SettingsService,
  { MAX_DIFF_CHARS: 123_456, MAX_CONTEXT_CHARS: 7_000, EXPAND_DIFF_CONTEXT: false, VERIFY_FINDINGS: false } as Env,
  { getReviewContext } as unknown as ProfilesService,
);

const queuedReview = { id: 'v1', prNumber: 7, headSha: 'abc1234', repository: { owner: 'acme', name: 'api' } };
const llm = { provider: 'anthropic', model: 'claude-x', apiKey: 'sk-ant-REALSECRET' };
const finding = {
  path: 'a.ts',
  startLine: null,
  line: 3,
  severity: 'high',
  title: 't',
  explanation: 'e',
  fixPrompt: 'f',
  suggestion: null,
  placement: 'inline',
};

beforeEach(() => {
  for (const fn of [findForRun, claim, saveResult, markFailed, getGithubToken, getLlmConfig, getReviewContext]) fn.mockReset();
  vi.mocked(getPullRequest).mockReset().mockResolvedValue({ headSha: 'abc1234' } as never);
  vi.mocked(reviewPullRequest).mockReset();
  findForRun.mockResolvedValue({ ...queuedReview, repositoryId: 'r1' });
  claim.mockResolvedValue(true);
  getGithubToken.mockResolvedValue('github_pat_REALTOKEN');
  getLlmConfig.mockResolvedValue(llm);
  getReviewContext.mockResolvedValue({ profile: undefined, notes: undefined });
});

describe('RunReviewWorker.run', () => {
  it('reviews the PR and saves the result with the database spellings of the enums', async () => {
    vi.mocked(reviewPullRequest).mockResolvedValue({
      outcome: 'posted',
      summary: 'Adds login.',
      findings: [finding, { ...finding, severity: 'low', placement: 'summary' }],
      skipped: [],
      usage: { inputTokens: 100, outputTokens: 20 },
      githubReviewUrl: 'https://github.com/acme/api/pull/7#pullrequestreview-1',
      fellBackToSummary: false,
    } as never);

    await service.run('v1');

    expect(vi.mocked(getPullRequest).mock.calls[0]!.slice(1)).toEqual(['acme', 'api', 7]);
    expect(vi.mocked(reviewPullRequest).mock.calls[0]![0]).toMatchObject({ llm, post: true, maxDiffChars: 123_456, maxContextChars: 7_000, expandContext: false, verify: false });
    expect(saveResult).toHaveBeenCalledWith('v1', {
      status: 'posted',
      summary: 'Adds login.',
      githubReviewUrl: 'https://github.com/acme/api/pull/7#pullrequestreview-1',
      provider: 'anthropic',
      model: 'claude-x',
      inputTokens: 100,
      outputTokens: 20,
      findings: [
        expect.objectContaining({ severity: 'high', placement: 'inline' }),
        expect.objectContaining({ severity: 'low', placement: 'summary' }),
      ],
    });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('marks the review SKIPPED, without posting, when every file was filtered out', async () => {
    vi.mocked(reviewPullRequest).mockResolvedValue({
      outcome: 'nothing-to-review',
      summary: 'No reviewable files in this pull request.',
      findings: [],
      skipped: [{ path: 'pnpm-lock.yaml', reason: 'lockfile' }],
      usage: undefined,
      githubReviewUrl: undefined,
      fellBackToSummary: false,
    } as never);

    await service.run('v1');

    expect(saveResult).toHaveBeenCalledWith('v1', expect.objectContaining({ status: 'skipped', provider: null, model: null, githubReviewUrl: null, findings: [] }));
  });

  it('skips instead of reviewing when the PR moved to a newer commit', async () => {
    vi.mocked(getPullRequest).mockResolvedValue({ headSha: 'def5678aaaa' } as never);

    await service.run('v1');

    expect(reviewPullRequest).not.toHaveBeenCalled();
    expect(saveResult).toHaveBeenCalledWith('v1', expect.objectContaining({ status: 'skipped', summary: expect.stringContaining('def5678') }));
  });

  it('records a failure on the review instead of throwing', async () => {
    vi.mocked(reviewPullRequest).mockRejectedValue(new Error('LLM call failed (anthropic/claude-x): invalid x-api-key'));

    await expect(service.run('v1')).resolves.toBeUndefined();

    expect(markFailed).toHaveBeenCalledWith('v1', 'LLM call failed (anthropic/claude-x): invalid x-api-key');
    expect(saveResult).not.toHaveBeenCalled();
  });

  it('removes both secrets from the stored error', async () => {
    vi.mocked(reviewPullRequest).mockRejectedValue(
      new Error('bad key sk-ant-REALSECRET and token github_pat_REALTOKEN were rejected'),
    );

    await service.run('v1');

    const stored = markFailed.mock.calls[0]![1] as string;
    expect(stored).toBe('bad key *** and token *** were rejected');
  });

  it('fails the review with a readable message when settings are incomplete', async () => {
    getLlmConfig.mockRejectedValue(new Error('Save an LLM provider, model and API key in Settings first.'));

    await service.run('v1');

    expect(markFailed).toHaveBeenCalledWith('v1', 'Save an LLM provider, model and API key in Settings first.');
    expect(getPullRequest).not.toHaveBeenCalled();
  });

  it('truncates a very long error message', async () => {
    vi.mocked(reviewPullRequest).mockRejectedValue(new Error('x'.repeat(5_000)));
    await service.run('v1');
    expect((markFailed.mock.calls[0]![1] as string).length).toBe(2_000);
  });

  it('does nothing for an unknown review', async () => {
    findForRun.mockResolvedValue(null);
    await service.run('nope');
    expect(claim).not.toHaveBeenCalled();
  });

  it('does nothing when the review cannot be claimed (already running or finished)', async () => {
    claim.mockResolvedValue(false);
    await service.run('v1');
    expect(getGithubToken).not.toHaveBeenCalled();
    expect(saveResult).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  describe('what is known about the repository', () => {
    const posted = {
      outcome: 'posted',
      summary: 's',
      findings: [],
      skipped: [],
      usage: undefined,
      githubReviewUrl: null,
      fellBackToSummary: false,
    };

    it('hands the profile and the notes of the repository to the review', async () => {
      getReviewContext.mockResolvedValue({ profile: '## Overview', notes: 'Money is in satang.' });
      vi.mocked(reviewPullRequest).mockResolvedValue(posted as never);

      await service.run('v1');

      expect(getReviewContext).toHaveBeenCalledWith('r1');
      expect(vi.mocked(reviewPullRequest).mock.calls[0]![0]).toMatchObject({ projectProfile: '## Overview', maintainerNotes: 'Money is in satang.' });
    });

    it('still reviews when the profile cannot be read', async () => {
      getReviewContext.mockRejectedValue(new Error('database hiccup'));
      vi.mocked(reviewPullRequest).mockResolvedValue(posted as never);

      await service.run('v1');

      expect(markFailed).not.toHaveBeenCalled();
      expect(vi.mocked(reviewPullRequest).mock.calls[0]![0].projectProfile).toBeUndefined();
      expect(saveResult).toHaveBeenCalled();
    });
  });
});
