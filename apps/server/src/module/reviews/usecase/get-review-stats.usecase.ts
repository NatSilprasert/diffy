import { Injectable } from '@nestjs/common';
import type { GetReviewStatsResponseDto } from '../dto/get-review-stats.dto';
import { periodStart } from '../reviews.period';
import { ReviewsRepository } from '../reviews.repository';

@Injectable()
export class GetReviewStatsUsecase {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  async execute(accountId: string, now: Date = new Date()): Promise<GetReviewStatsResponseDto> {
    const [total, month, week, day] = await Promise.all([
      this.reviewsRepository.countSince(accountId),
      this.reviewsRepository.countSince(accountId, periodStart('month', now)),
      this.reviewsRepository.countSince(accountId, periodStart('week', now)),
      this.reviewsRepository.countSince(accountId, periodStart('day', now)),
    ]);
    return { total, month, week, day };
  }
}
