import { Injectable } from '@nestjs/common';
import type { WatchedRepo } from '../repos/repos.service';
import { isReviewable, type ReviewablePullRequest } from './review-eligibility';
import { ReviewsRepository } from './reviews.repository';
import { ReviewQueueWorker } from './worker/review-queue.worker';

export type IncomingPullRequest = ReviewablePullRequest & { number: number; title: string; url: string };

// The reviews module's public API for other modules (the webhook).
@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reviewQueue: ReviewQueueWorker,
  ) {}

  // Queues a review of this commit of a pull request, unless it is not reviewable (draft, bot, already open when the
  // repository was added) or this commit was seen before. True when a review was queued.
  async queueReview(repo: WatchedRepo, pr: IncomingPullRequest): Promise<boolean> {
    if (!isReviewable(pr, repo.baselineShas)) return false;
    const { review, created } = await this.reviewsRepository.createQueued({
      repositoryId: repo.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.url,
      headSha: pr.headSha,
    });
    if (created) this.reviewQueue.enqueue(review.id);
    return created;
  }
}
