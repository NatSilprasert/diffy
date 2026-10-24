import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RetryReviewParamsDto, RetryReviewResponseDto } from '../dto/retry-review.dto';
import { toReviewItem } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';
import { ReviewQueueService } from '../worker/review-queue.service';

@Injectable()
export class RetryReviewUsecase {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reviewQueue: ReviewQueueService,
  ) {}

  async execute(params: RetryReviewParamsDto): Promise<RetryReviewResponseDto> {
    const review = await this.reviewsRepository.findById(params.id);
    if (!review) throw new NotFoundException('Review not found.');

    // Only a failed review is retried. A posted one would be posted a second time, a queued or running
    // one is already being handled, and a skipped one would be skipped again for the same reason.
    const requeued = await this.reviewsRepository.requeueIfFailed(params.id);
    if (!requeued) {
      throw new ConflictException(`Only failed reviews can be retried. This review is ${review.status}.`);
    }

    this.reviewQueue.enqueue(requeued.id);
    return toReviewItem(requeued);
  }
}
