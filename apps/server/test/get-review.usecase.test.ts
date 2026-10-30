import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GetReviewResponseSchema } from '../src/module/reviews/dto/get-review.dto';
import type { ReviewsRepository } from '../src/module/reviews/reviews.repository';
import { GetReviewUsecase } from '../src/module/reviews/usecase/get-review.usecase';

const finding = (n: number, over: Record<string, unknown> = {}) => ({
  id: `f${n}`,
  reviewId: 'v1',
  severity: 'high' as const,
  placement: 'inline' as const,
  path: 'src/auth.ts',
  startLine: null,
  line: n,
  title: `Problem ${n}`,
  explanation: 'e',
  fixPrompt: 'f',
  suggestion: null,
  ...over,
});

const review = {
  id: 'v1',
  repositoryId: 'r1',
  prNumber: 7,
  prTitle: 'Add login',
  prUrl: 'https://github.com/acme/api/pull/7',
  headSha: 'abc1234',
  status: 'posted' as const,
  summary: 'Adds login.',
  githubReviewUrl: 'https://github.com/acme/api/pull/7#pullrequestreview-1',
  provider: 'anthropic' as const,
  model: 'claude-x',
  inputTokens: 100,
  outputTokens: 20,
  error: null,
  createdAt: new Date('2026-10-24T01:02:03.000Z'),
  finishedAt: new Date('2026-10-24T01:03:00.000Z'),
  repository: { owner: 'acme', name: 'api' },
  findings: [finding(2), finding(9, { placement: 'summary', suggestion: 'x();' })],
};

const findDetail = vi.fn();
const usecase = (found: unknown) => {
  findDetail.mockReset().mockResolvedValue(found);
  return new GetReviewUsecase({ findDetail } as unknown as ReviewsRepository);
};

describe('GetReviewUsecase', () => {
  it('looks for the review inside the account of the person: another account\'s review is not found', async () => {
    await usecase(review).execute('acc1', { id: 'v1' });
    expect(findDetail).toHaveBeenCalledWith('v1', 'acc1');
  });

  it('returns the review, its details and its findings', async () => {
    const result = await usecase(review).execute('acc1', { id: 'v1' });

    expect(result.review).toMatchObject({
      id: 'v1',
      repoFullName: 'acme/api',
      status: 'posted',
      summary: 'Adds login.',
      provider: 'anthropic',
      model: 'claude-x',
      inputTokens: 100,
      outputTokens: 20,
      createdAt: '2026-10-24T01:02:03.000Z',
      finishedAt: '2026-10-24T01:03:00.000Z',
    });
    expect(result.findings).toHaveLength(2);
    expect(result.findings[1]).toMatchObject({ id: 'f9', placement: 'summary', suggestion: 'x();' });
    expect(GetReviewResponseSchema.safeParse(result).success).toBe(true);
  });

  it('does not expose the internal reviewId on findings', async () => {
    const result = await usecase(review).execute('acc1', { id: 'v1' });
    expect(result.findings[0]).not.toHaveProperty('reviewId');
  });

  it('works for a review that has no findings yet (queued or failed)', async () => {
    const queued = { ...review, status: 'queued' as const, summary: null, provider: null, model: null, finishedAt: null, findings: [] };
    const result = await usecase(queued).execute('acc1', { id: 'v1' });
    expect(result.findings).toEqual([]);
    expect(GetReviewResponseSchema.safeParse(result).success).toBe(true);
  });

  it('returns 404 for an unknown id', async () => {
    await expect(usecase(null).execute('acc1', { id: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
