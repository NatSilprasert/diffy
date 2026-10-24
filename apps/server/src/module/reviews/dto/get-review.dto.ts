import { Finding, LlmProvider } from '@diffy/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ReviewItemSchema } from './review-item.schema';

export const GetReviewParamsSchema = z.object({
  id: z.string().min(1),
});
export class GetReviewParamsDto extends createZodDto(GetReviewParamsSchema) {}

export const ReviewDetailSchema = ReviewItemSchema.extend({
  repoFullName: z.string(),
  summary: z.string().describe('The overall summary the model wrote; null until the review has run').nullable(),
  provider: LlmProvider.nullable(),
  model: z.string().describe('The model that did the review; null until it has run').nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
});

export const ReviewFindingSchema = Finding.extend({ id: z.string() });

export const GetReviewResponseSchema = z.object({
  review: ReviewDetailSchema,
  findings: z.array(ReviewFindingSchema),
});
export class GetReviewResponseDto extends createZodDto(GetReviewResponseSchema) {}
