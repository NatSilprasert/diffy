import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RepoItemSchema } from './repo-item.schema';

export const AddRepoRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'must look like "owner/name"'),
});
export class AddRepoRequestDto extends createZodDto(AddRepoRequestSchema) {}

export const AddRepoResponseSchema = RepoItemSchema;
export class AddRepoResponseDto extends createZodDto(AddRepoResponseSchema) {}
