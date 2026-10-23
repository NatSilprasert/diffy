import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetHealthResponseSchema = z.object({
  ok: z.literal(true),
  database: z.literal('up'),
});
export class GetHealthResponseDto extends createZodDto(GetHealthResponseSchema) {}
