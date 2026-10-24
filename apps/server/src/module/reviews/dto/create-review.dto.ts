import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ReviewItemSchema } from './review-item.schema';

export const CreateReviewRequestSchema = z.object({
  repositoryId: z.string().min(1),
  prNumber: z.number().int().positive(),
});
export class CreateReviewRequestDto extends createZodDto(CreateReviewRequestSchema) {}

export const CreateReviewResponseSchema = z.object({
  // True when this commit of the PR already has a review (any status), so nothing new was queued.
  skipped: z.boolean(),
  review: ReviewItemSchema,
});
export class CreateReviewResponseDto extends createZodDto(CreateReviewResponseSchema) {}
