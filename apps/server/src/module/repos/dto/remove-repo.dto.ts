import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RemoveRepoParamsSchema = z.object({
  id: z.string().min(1),
});
export class RemoveRepoParamsDto extends createZodDto(RemoveRepoParamsSchema) {}
