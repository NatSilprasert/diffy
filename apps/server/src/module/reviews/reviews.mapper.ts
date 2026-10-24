import type { Review } from '../../generated/prisma/client';
import type { Severity } from '../../generated/prisma/enums';
import type { GetReviewResponseDto } from './dto/get-review.dto';
import type { ReviewListItem } from './dto/list-reviews.dto';
import type { ReviewItem } from './dto/review-item.schema';

// Enum values are spelled the same in the database and in the API, so they pass through as they are.
export function toReviewItem(review: Review): ReviewItem {
  return {
    id: review.id,
    repositoryId: review.repositoryId,
    prNumber: review.prNumber,
    prTitle: review.prTitle,
    prUrl: review.prUrl,
    headSha: review.headSha,
    status: review.status,
    error: review.error,
    githubReviewUrl: review.githubReviewUrl,
    createdAt: review.createdAt.toISOString(),
    finishedAt: review.finishedAt?.toISOString() ?? null,
  };
}

type WithRepository<T> = T & { repository: { owner: string; name: string } };

const repoFullName = (review: WithRepository<Review>) => `${review.repository.owner}/${review.repository.name}`;

export type SeverityCount = { reviewId: string; severity: Severity; count: number };

export function toReviewListItem(review: WithRepository<Review>, counts: SeverityCount[]): ReviewListItem {
  const findingCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const { reviewId, severity, count } of counts) {
    if (reviewId === review.id) findingCounts[severity] = count;
  }
  return { ...toReviewItem(review), repoFullName: repoFullName(review), findingCounts };
}

type FindingRow = {
  id: string;
  severity: Severity;
  placement: 'inline' | 'summary';
  path: string;
  startLine: number | null;
  line: number;
  title: string;
  explanation: string;
  fixPrompt: string;
  suggestion: string | null;
};

export function toReviewDetail(review: WithRepository<Review> & { findings: FindingRow[] }): GetReviewResponseDto {
  return {
    review: {
      ...toReviewItem(review),
      repoFullName: repoFullName(review),
      summary: review.summary,
      provider: review.provider,
      model: review.model,
      inputTokens: review.inputTokens,
      outputTokens: review.outputTokens,
    },
    // Fields are listed one by one so database-only columns (like reviewId) never reach the API.
    findings: review.findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      placement: finding.placement,
      path: finding.path,
      startLine: finding.startLine,
      line: finding.line,
      title: finding.title,
      explanation: finding.explanation,
      fixPrompt: finding.fixPrompt,
      suggestion: finding.suggestion,
    })),
  };
}
