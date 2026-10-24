import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListAvailableReposQuerySchema = z.object({
  // Case-insensitive substring of "owner/name". Leave out to list everything.
  q: z.string().trim().optional(),
});
export class ListAvailableReposQueryDto extends createZodDto(ListAvailableReposQuerySchema) {}

export const ListAvailableReposResponseSchema = z.object({
  repos: z.array(
    z.object({
      fullName: z.string(),
      owner: z.string(),
      name: z.string(),
      isPrivate: z.boolean(),
    }),
  ),
  // True when more repositories matched than were returned. Type more of the name to narrow it down.
  hasMore: z.boolean(),
});
export class ListAvailableReposResponseDto extends createZodDto(ListAvailableReposResponseSchema) {}
