import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProfileItemSchema } from './profile-item.schema';

export const RebuildProfileParamsSchema = z.object({ repositoryId: z.string().min(1) });
export class RebuildProfileParamsDto extends createZodDto(RebuildProfileParamsSchema) {}

export const RebuildProfileResponseSchema = ProfileItemSchema;
export class RebuildProfileResponseDto extends createZodDto(RebuildProfileResponseSchema) {}
