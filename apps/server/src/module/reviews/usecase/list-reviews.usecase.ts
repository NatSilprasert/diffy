import { Injectable } from '@nestjs/common';
import type { ListReviewsQueryDto, ListReviewsResponseDto } from '../dto/list-reviews.dto';
import { periodStart } from '../reviews.period';
import { toReviewListItem } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';

@Injectable()
export class ListReviewsUsecase {
  constructor(private readonly reviewsRepository: ReviewsRepository) {}

  async execute(accountId: string, input: ListReviewsQueryDto): Promise<ListReviewsResponseDto> {
    const { limit, cursor, repositoryId, status, period, q } = input;
    const since = period ? periodStart(period) : undefined;
    const rows = await this.reviewsRepository.listPage({ accountId, repositoryId, status, since, search: q }, limit, cursor);

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
