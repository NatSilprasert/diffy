import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Octokit } from 'octokit';

vi.mock('../src/llm.js', () => ({ generateReview: vi.fn() }));

import { generateReview } from '../src/llm.js';
import type { PullRequestInfo } from '../src/github.js';
import { reviewPullRequest } from '../src/review.js';

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

const llm = { provider: 'openai', model: 'm', apiKey: 'k' } as const;

const file = (filename: string, patch?: string) => ({ filename, status: 'modified', additions: 1, deletions: 0, patch });
const authPatch = '@@ -10,3 +10,4 @@\n a\n+b\n c';

const llmFinding = (line: number) => ({
  path: 'src/auth.ts',
  startLine: null,
  line,
  severity: 'high' as const,
  title: 't',
  explanation: 'e',
  fixPrompt: 'f',
  suggestion: null,
});

function fakeOctokit(files: ReturnType<typeof file>[]) {
  const createReview = vi.fn().mockResolvedValue({ data: { html_url: 'https://github.com/review/1' } });
  const octokit = {
    paginate: vi.fn().mockResolvedValue(files),
    rest: { pulls: { listFiles: vi.fn(), createReview } },
  } as unknown as Octokit;
  return { octokit, createReview };
}

beforeEach(() => {
  // Braces matter: a function returned from beforeEach is run by vitest as teardown.
  vi.mocked(generateReview).mockReset();
});

describe('reviewPullRequest', () => {
  it('runs the pipeline and posts one review with placed findings', async () => {
    vi.mocked(generateReview).mockResolvedValue({
      review: { summary: 'Adds login.', findings: [llmFinding(11), llmFinding(500)] },
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    const { octokit, createReview } = fakeOctokit([file('src/auth.ts', authPatch), file('pnpm-lock.yaml', authPatch)]);

    const result = await reviewPullRequest({ octokit, pr, llm });

    expect(result.outcome).toBe('posted');
    expect(result.githubReviewUrl).toBe('https://github.com/review/1');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
    expect(result.skipped).toEqual([{ path: 'pnpm-lock.yaml', reason: 'lockfile' }]);
    expect(result.findings.map((f) => f.placement)).toEqual(['inline', 'summary']);
    expect(createReview).toHaveBeenCalledTimes(1);
    expect(createReview.mock.calls[0]![0].comments).toHaveLength(1);
  });

  it('does not post when post is false', async () => {
    vi.mocked(generateReview).mockResolvedValue({
      review: { summary: 's', findings: [llmFinding(11)] },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const { octokit, createReview } = fakeOctokit([file('src/auth.ts', authPatch)]);

    const result = await reviewPullRequest({ octokit, pr, llm, post: false });

    expect(result.outcome).toBe('not-posted');
    expect(result.githubReviewUrl).toBeUndefined();
    expect(result.findings).toHaveLength(1);
    expect(createReview).not.toHaveBeenCalled();
  });

  it('skips the LLM and GitHub when nothing is reviewable', async () => {
    const { octokit, createReview } = fakeOctokit([file('pnpm-lock.yaml', authPatch), file('logo.png')]);

    const result = await reviewPullRequest({ octokit, pr, llm });

    expect(result.outcome).toBe('nothing-to-review');
    expect(result.skipped).toHaveLength(2);
    expect(generateReview).not.toHaveBeenCalled();
    expect(createReview).not.toHaveBeenCalled();
  });

  it('lets an LLM failure propagate without posting', async () => {
    vi.mocked(generateReview).mockRejectedValue(new Error('LLM call failed (openai/m): bad key'));
    const { octokit, createReview } = fakeOctokit([file('src/auth.ts', authPatch)]);

    await expect(reviewPullRequest({ octokit, pr, llm })).rejects.toThrow('bad key');
    expect(createReview).not.toHaveBeenCalled();
  });
});
