import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// How many reviews exist, in total and in each time window. Every status counts, so each number
// equals the length of the list you get by filtering the reviews page by the same window.
export const GetReviewStatsResponseSchema = z.object({
  total: z.number().int(),
  month: z.number().int(),
  week: z.number().int(),
  day: z.number().int(),
});
export class GetReviewStatsResponseDto extends createZodDto(GetReviewStatsResponseSchema) {}
