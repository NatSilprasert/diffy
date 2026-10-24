import { Injectable } from '@nestjs/common';
import type { ListReviewsQueryDto, ListReviewsResponseDto } from '../dto/list-reviews.dto';
import { toReviewListItem } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';

@Injectable()
export class ListReviewsUsecase {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  async execute(input: ListReviewsQueryDto): Promise<ListReviewsResponseDto> {
    const { limit, cursor, repositoryId, status } = input;
    const rows = await this.reviewsRepository.listPage({ repositoryId, status }, limit, cursor);

    // One extra row was fetched: its presence means there is a next page, and it is not shown.
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const counts = await this.reviewsRepository.countFindingsBySeverity(page.map((row) => row.id));

    return {
      reviews: page.map((row) => toReviewListItem(row, counts)),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }
}
