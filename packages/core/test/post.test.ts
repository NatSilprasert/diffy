import { describe, expect, it, vi } from 'vitest';
import type { Finding } from '@diffy/shared';
import type { Octokit } from 'octokit';
import type { PullRequestInfo } from '../src/github.js';
import { postReview } from '../src/post.js';

const pr: PullRequestInfo = {
  owner: 'acme',
  repo: 'api',
  number: 7,
  title: 'Add login',
  body: '',
  url: 'https://github.com/acme/api/pull/7',
  headSha: 'abcdef1234567',
  isDraft: false,
  authorLogin: 'dev',
  authorIsBot: false,
};

const finding = (over: Partial<Finding> = {}): Finding => ({
  path: 'src/auth.ts',
  startLine: null,
  line: 11,
  severity: 'high',
  title: 'Token not validated',
  explanation: 'e',
  fixPrompt: 'f',
  suggestion: null,
  placement: 'inline',
  ...over,
});

const input = (findings: Finding[]) => ({ pr, summary: 'S', findings, skipped: [], model: 'm' });

function fakeOctokit(createReview: ReturnType<typeof vi.fn>): Octokit {
  return { rest: { pulls: { createReview } } } as unknown as Octokit;
}

const ok = { data: { html_url: 'https://github.com/acme/api/pull/7#pullrequestreview-1' } };

describe('postReview', () => {
  it('posts one COMMENT review pinned to the head commit, with inline comments', async () => {
    const createReview = vi.fn().mockResolvedValue(ok);
    const result = await postReview(
      fakeOctokit(createReview),
      input([finding(), finding({ startLine: 9, line: 11 }), finding({ placement: 'summary', line: 90 })]),
    );

    expect(createReview).toHaveBeenCalledTimes(1);
    const args = createReview.mock.calls[0]![0];
    expect(args).toMatchObject({ owner: 'acme', repo: 'api', pull_number: 7, commit_id: 'abcdef1234567', event: 'COMMENT' });
    expect(args.comments).toHaveLength(2);
    expect(args.comments[0]).toMatchObject({ path: 'src/auth.ts', line: 11, side: 'RIGHT' });
    expect(args.comments[0]).not.toHaveProperty('start_line');
    expect(args.comments[1]).toMatchObject({ start_line: 9, start_side: 'RIGHT', line: 11 });
    expect(result).toMatchObject({ url: ok.data.html_url, fellBackToSummary: false });
  });

  it('omits comments when every finding is in the summary', async () => {
    const createReview = vi.fn().mockResolvedValue(ok);
    await postReview(fakeOctokit(createReview), input([finding({ placement: 'summary' })]));
    expect(createReview.mock.calls[0]![0].comments).toBeUndefined();
  });

  it('retries once with everything in the summary after a 422', async () => {
    const createReview = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unprocessable Entity'), { status: 422 }))
      .mockResolvedValueOnce(ok);
    const result = await postReview(fakeOctokit(createReview), input([finding()]));

    expect(createReview).toHaveBeenCalledTimes(2);
    const retry = createReview.mock.calls[1]![0];
    expect(retry.comments).toBeUndefined();
    expect(retry.body).toContain('Findings outside the changed lines (1)');
    expect(result.fellBackToSummary).toBe(true);
    expect(result.findings.every((f) => f.placement === 'summary')).toBe(true);
  });

  it('does not retry other errors', async () => {
    const createReview = vi.fn().mockRejectedValue(Object.assign(new Error('Bad credentials'), { status: 401 }));
    await expect(postReview(fakeOctokit(createReview), input([finding()]))).rejects.toThrow('Bad credentials');
    expect(createReview).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 422 when there were no inline comments to blame', async () => {
    const createReview = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 422 }));
    await expect(postReview(fakeOctokit(createReview), input([finding({ placement: 'summary' })]))).rejects.toThrow('nope');
    expect(createReview).toHaveBeenCalledTimes(1);
  });
});
