import type { ReviewStatus as ApiReviewStatus } from '@diffy/shared';
import type { Review } from '../../generated/prisma/client';
import type { ReviewStatus as DbReviewStatus } from '../../generated/prisma/enums';
import type { ReviewItem } from './dto/review-item.schema';

// The database enum is UPPER_CASE, the API (and @diffy/shared) is lower-case.
// A Record keeps this exhaustive: a new status fails the build until it is mapped.
const STATUS_TO_API: Record<DbReviewStatus, ApiReviewStatus> = {
  QUEUED: 'queued',
  RUNNING: 'running',
  POSTED: 'posted',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export const toApiStatus = (status: DbReviewStatus): ApiReviewStatus => STATUS_TO_API[status];

export function toReviewItem(review: Review): ReviewItem {
  return {
    id: review.id,
    repositoryId: review.repositoryId,
    prNumber: review.prNumber,
    prTitle: review.prTitle,
    prUrl: review.prUrl,
    headSha: review.headSha,
    status: toApiStatus(review.status),
    error: review.error,
    githubReviewUrl: review.githubReviewUrl,
    createdAt: review.createdAt.toISOString(),
    finishedAt: review.finishedAt?.toISOString() ?? null,
  };
}
