import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RepoItemSchema } from './repo-item.schema';

export const ListReposResponseSchema = z.object({
  repos: z.array(RepoItemSchema),
});
export class ListReposResponseDto extends createZodDto(ListReposResponseSchema) {}
