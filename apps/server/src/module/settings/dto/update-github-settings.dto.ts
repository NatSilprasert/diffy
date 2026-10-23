import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateGithubSettingsRequestSchema = z.object({
  // trim: tokens pasted from a terminal or web page often carry a trailing newline.
  token: z.string().trim().min(1, 'token is required'),
});
export class UpdateGithubSettingsRequestDto extends createZodDto(UpdateGithubSettingsRequestSchema) {}

export const UpdateGithubSettingsResponseSchema = z.object({
  login: z.string(),
});
export class UpdateGithubSettingsResponseDto extends createZodDto(UpdateGithubSettingsResponseSchema) {}
