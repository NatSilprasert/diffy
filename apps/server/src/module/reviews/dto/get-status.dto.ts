import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetStatusResponseSchema = z.object({
  queue: z.object({
    // Reviews waiting for their turn (not counting the one running).
    waiting: z.number().int(),
    // The review being worked on right now, if any.
    current: z
      .object({
        reviewId: z.string(),
        repoFullName: z.string(),
        prNumber: z.number().int(),
        prTitle: z.string(),
      })
      .nullable(),
  }),
});
export class GetStatusResponseDto extends createZodDto(GetStatusResponseSchema) {}
