import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RepoItemSchema } from './repo-item.schema';

export const UpdateRepoParamsSchema = z.object({
  id: z.string().min(1),
});
export class UpdateRepoParamsDto extends createZodDto(UpdateRepoParamsSchema) {}

export const UpdateRepoRequestSchema = z.object({
  // false pauses the repo: it stays in the list but is not polled.
  enabled: z.boolean(),
});
export class UpdateRepoRequestDto extends createZodDto(UpdateRepoRequestSchema) {}

export const UpdateRepoResponseSchema = RepoItemSchema;
export class UpdateRepoResponseDto extends createZodDto(UpdateRepoResponseSchema) {}
