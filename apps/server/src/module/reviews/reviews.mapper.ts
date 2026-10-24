import type { Review } from '../../generated/prisma/client';
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
