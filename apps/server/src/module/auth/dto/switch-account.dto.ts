import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuthViewSchema } from './auth-view.schema';

export const SwitchAccountRequestSchema = z.object({ accountId: z.string().min(1) });
export class SwitchAccountRequestDto extends createZodDto(SwitchAccountRequestSchema) {}

export const SwitchAccountResponseSchema = AuthViewSchema;
export class SwitchAccountResponseDto extends createZodDto(SwitchAccountResponseSchema) {}
