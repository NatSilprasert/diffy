import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProfileItemSchema } from './profile-item.schema';

export const GetProfileParamsSchema = z.object({ repositoryId: z.string().min(1) });
export class GetProfileParamsDto extends createZodDto(GetProfileParamsSchema) {}

export const GetProfileResponseSchema = ProfileItemSchema;
export class GetProfileResponseDto extends createZodDto(GetProfileResponseSchema) {}
