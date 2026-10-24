import { Injectable, NotFoundException } from '@nestjs/common';
import type { GetReviewParamsDto, GetReviewResponseDto } from '../dto/get-review.dto';
import { toReviewDetail } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';

@Injectable()
export class GetReviewUsecase {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  async execute(params: GetReviewParamsDto): Promise<GetReviewResponseDto> {
    const review = await this.reviewsRepository.findDetail(params.id);
    if (!review) throw new NotFoundException('Review not found.');
    return toReviewDetail(review);
  }
}
