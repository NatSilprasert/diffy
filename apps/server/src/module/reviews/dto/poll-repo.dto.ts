import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PollRepoRequestSchema = z.object({
  repositoryId: z.string().min(1),
});
export class PollRepoRequestDto extends createZodDto(PollRepoRequestSchema) {}

// A failed poll is a normal result (it is also stored on the repository), so it comes back as 200.
export const PollRepoResponseSchema = z.object({
  queued: z.number().int(),
  error: z.string().nullable(),
});
export class PollRepoResponseDto extends createZodDto(PollRepoResponseSchema) {}
