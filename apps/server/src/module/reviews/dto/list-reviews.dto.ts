import { ReviewStatus } from '@diffy/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ReviewItemSchema } from './review-item.schema';

export const DEFAULT_REVIEWS_PAGE_SIZE = 20;
export const MAX_REVIEWS_PAGE_SIZE = 100;

export const ListReviewsQuerySchema = z.object({
  repositoryId: z.string().min(1).optional(),
  status: ReviewStatus.optional(),
  // The nextCursor of the previous page. Leave out for the first page.
  cursor: z.string().min(1).optional(),
  // Query strings are text, so the number is converted here.
  limit: z.coerce.number().int().min(1).max(MAX_REVIEWS_PAGE_SIZE).default(DEFAULT_REVIEWS_PAGE_SIZE),
});
export class ListReviewsQueryDto extends createZodDto(ListReviewsQuerySchema) {}

const FindingCountsSchema = z.object({
  critical: z.number().int(),
  high: z.number().int(),
  medium: z.number().int(),
  low: z.number().int(),
});

export const ReviewListItemSchema = ReviewItemSchema.extend({
  repoFullName: z.string(),
  findingCounts: FindingCountsSchema,
});
export type ReviewListItem = z.infer<typeof ReviewListItemSchema>;

export const ListReviewsResponseSchema = z.object({
  reviews: z.array(ReviewListItemSchema),
  // Pass this as `cursor` to get the next page; null when this was the last one.
  nextCursor: z.string().describe('Pass as `cursor` for the next page').nullable(),
});
export class ListReviewsResponseDto extends createZodDto(ListReviewsResponseSchema) {}
