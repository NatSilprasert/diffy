import { createZodDto } from 'nestjs-zod';
import { AuthViewSchema } from './auth-view.schema';

export const GetMeResponseSchema = AuthViewSchema;
export class GetMeResponseDto extends createZodDto(GetMeResponseSchema) {}
