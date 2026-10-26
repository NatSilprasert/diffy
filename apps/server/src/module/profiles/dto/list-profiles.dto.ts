import { ProfileStatus } from '@diffy/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Where the profile of each repository is, in one call, for the list of repositories. Repositories that have no
// profile yet are not in it.
export const ListProfilesResponseSchema = z.object({
  profiles: z.array(
    z.object({
      repositoryId: z.string(),
      status: ProfileStatus,
      builtAt: z.iso.datetime().nullable(),
    }),
  ),
});
export class ListProfilesResponseDto extends createZodDto(ListProfilesResponseSchema) {}
