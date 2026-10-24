import { Injectable } from '@nestjs/common';
import type { Review } from '../../generated/prisma/client';
import type { LlmProvider, Placement, Severity } from '../../generated/prisma/enums';
import { isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';

type NewReview = {
  repositoryId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  headSha: string;
};

export type NewFinding = {
  severity: Severity;
  placement: Placement;
  path: string;
  startLine: number | null;
  line: number;
  title: string;
  explanation: string;
  fixPrompt: string;
  suggestion: string | null;
};

export type ReviewResultData = {
  status: 'posted' | 'skipped';
  summary: string;
  githubReviewUrl: string | null;
  provider: LlmProvider | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  findings: NewFinding[];
};

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // The unique (repository, PR, head commit) constraint is what stops the same commit being reviewed
  // twice, even if two requests race. On a duplicate this returns the row that is already there.
  async createQueued(data: NewReview): Promise<{ review: Review; created: boolean }> {
    try {
      return { review: await this.prisma.review.create({ data }), created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const { repositoryId, prNumber, headSha } = data;
      const existing = await this.prisma.review.findUnique({
        where: { repositoryId_prNumber_headSha: { repositoryId, prNumber, headSha } },
      });
      if (!existing) throw err;
      return { review: existing, created: false };
    }
  }

  // A review together with the repository it belongs to, for the worker.
  findForRun(id: string) {
    return this.prisma.review.findUnique({ where: { id }, include: { repository: true } });
  }

  // queued -> running, done in one conditional update. Only one caller can win, so a review
  // can never be processed twice. Returns false if it was not queued any more.
  async claim(id: string): Promise<boolean> {
    const result = await this.prisma.review.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'running', error: null },
    });
    return result.count > 0;
  }

  // The review and its findings are written together: a half-saved result would be misleading.
  async saveResult(id: string, { findings, ...review }: ReviewResultData): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.review.update({ where: { id }, data: { ...review, error: null, finishedAt: new Date() } }),
      this.prisma.finding.createMany({ data: findings.map((finding) => ({ ...finding, reviewId: id })) }),
    ]);
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.review.update({ where: { id }, data: { status: 'failed', error, finishedAt: new Date() } });
  }
}
