import { Injectable } from '@nestjs/common';
import type { Prisma, Review } from '../../generated/prisma/client';
import type { LlmProvider, Placement, ReviewStatus, Severity } from '../../generated/prisma/enums';
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

export type ReviewFilter = {
  repositoryId?: string;
  status?: ReviewStatus;
  // Only reviews created at or after this moment.
  since?: Date;
  // Free text, see ListReviewsQuery.
  search?: string;
};

// Turns the filter into a Prisma where, leaving out every condition that was not asked for.
function buildWhere({ repositoryId, status, since, search }: ReviewFilter): Prisma.ReviewWhereInput {
  const where: Prisma.ReviewWhereInput = {};
  if (repositoryId) where.repositoryId = repositoryId;
  if (status) where.status = status;
  if (since) where.createdAt = { gte: since };

  const text = search?.trim();
  if (text) {
    const term = text.replace(/^#/, '');
    const any: Prisma.ReviewWhereInput[] = [
      { prTitle: { contains: term, mode: 'insensitive' } },
      { repository: { owner: { contains: term, mode: 'insensitive' } } },
      { repository: { name: { contains: term, mode: 'insensitive' } } },
    ];
    if (/^\d{1,9}$/.test(term)) any.push({ prNumber: Number(term) });
    if (/^[0-9a-f]{4,40}$/i.test(term)) any.push({ headSha: { startsWith: term.toLowerCase() } });
    // "owner/name", or a part of it on each side of the slash.
    const [owner, name] = term.split('/');
    if (term.includes('/') && owner && name) {
      any.push({
        repository: { owner: { contains: owner, mode: 'insensitive' }, name: { contains: name, mode: 'insensitive' } },
      });
    }
    where.OR = any;
  }
  return where;
}

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

  // Newest first. Fetches one row more than asked for, so the caller can tell if another page exists.
  // The cursor is the id of the last row of the previous page; id is the tie-breaker for equal createdAt.
  listPage(filter: ReviewFilter, limit: number, cursor?: string) {
    return this.prisma.review.findMany({
      where: buildWhere(filter),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { repository: true },
    });
  }

  // How many reviews exist, optionally only those created at or after `since`.
  countSince(since?: Date) {
    return this.prisma.review.count({ where: since ? { createdAt: { gte: since } } : {} });
  }

  // How many findings of each severity, for a set of reviews, in one query.
  async countFindingsBySeverity(reviewIds: string[]) {
    if (reviewIds.length === 0) return [];
    const groups = await this.prisma.finding.groupBy({
      by: ['reviewId', 'severity'],
      where: { reviewId: { in: reviewIds } },
      _count: { _all: true },
    });
    return groups.map((group) => ({ reviewId: group.reviewId, severity: group.severity, count: group._count._all }));
  }

  // Findings come back most severe first (the enum is declared critical -> low), then by position.
  findDetail(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        repository: true,
        findings: { orderBy: [{ severity: 'asc' }, { path: 'asc' }, { line: 'asc' }] },
      },
    });
  }

  findById(id: string) {
    return this.prisma.review.findUnique({ where: { id } });
  }

  // failed -> queued, as one conditional update: of two simultaneous retries only one can win.
  // Returns the updated row, or null if the review was not failed (any more).
  async requeueIfFailed(id: string): Promise<Review | null> {
    const result = await this.prisma.review.updateMany({
      where: { id, status: 'failed' },
      data: { status: 'queued', error: null, finishedAt: null },
    });
    return result.count > 0 ? this.findById(id) : null;
  }

  // For startup. A review left 'running' means the server stopped in the middle of it, so it goes
  // back to 'queued' (claim only accepts queued rows). Returns every queued id, oldest first.
  async recoverUnfinished(): Promise<string[]> {
    await this.prisma.review.updateMany({ where: { status: 'running' }, data: { status: 'queued' } });
    const queued = await this.prisma.review.findMany({
      where: { status: 'queued' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return queued.map((review) => review.id);
  }
}
