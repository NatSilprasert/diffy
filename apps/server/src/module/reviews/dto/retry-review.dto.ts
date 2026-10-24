import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ReviewItemSchema } from './review-item.schema';

export const RetryReviewParamsSchema = z.object({
  id: z.string().min(1),
});
export class RetryReviewParamsDto extends createZodDto(RetryReviewParamsSchema) {}

export const RetryReviewResponseSchema = ReviewItemSchema;
export class RetryReviewResponseDto extends createZodDto(RetryReviewResponseSchema) {}
