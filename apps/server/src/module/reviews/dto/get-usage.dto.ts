import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UsageTotalsSchema = z.object({
  reviews: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
});

// Every group is given twice, over all time and over the current calendar month, so the page can switch between
// the two without asking again.
const WithMonth = { allTime: UsageTotalsSchema, month: UsageTotalsSchema };

export const GetUsageResponseSchema = z.object({
  allTime: UsageTotalsSchema,
  month: UsageTotalsSchema,
  byModel: z.array(z.object({ provider: z.string(), model: z.string(), ...WithMonth })),
  byRepo: z.array(z.object({ repositoryId: z.string(), repoFullName: z.string(), ...WithMonth })),
  // One entry per day for the last 365 days, oldest first, days without reviews included (count 0).
  days: z.array(z.object({ date: z.string().describe('YYYY-MM-DD in the server local time'), count: z.number().int() })),
});
export class GetUsageResponseDto extends createZodDto(GetUsageResponseSchema) {}
