import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RetryReviewParamsDto, RetryReviewResponseDto } from '../dto/retry-review.dto';
import { toReviewItem } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';
import { ReviewQueueWorker } from '../worker/review-queue.worker';

@Injectable()
export class RetryReviewUsecase {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reviewQueue: ReviewQueueWorker,
  ) {}

  async execute(accountId: string, params: RetryReviewParamsDto): Promise<RetryReviewResponseDto> {
    const review = await this.reviewsRepository.findOfAccount(params.id, accountId);
    if (!review) throw new NotFoundException('Review not found.');

    // Any finished review can run again on the same commit: a failed one to get a result, a posted one to get
    // a fresh opinion (it posts a new review on GitHub). Only a queued or running one is refused, since it is
    // already being handled.
    const requeued = await this.reviewsRepository.requeueIfFinished(params.id);
    if (!requeued) {
      throw new ConflictException(`This review is ${review.status}. It is already being handled, so it cannot be started again.`);
    }

    this.reviewQueue.enqueue(requeued.id);
    return toReviewItem(requeued);
  }
}
