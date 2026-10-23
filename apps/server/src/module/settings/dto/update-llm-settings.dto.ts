import { LlmProvider } from '@diffy/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateLlmSettingsRequestSchema = z.object({
  provider: LlmProvider,
  model: z.string().trim().min(1, 'model is required'),
  // Omit to keep the key already saved for the same provider. An empty string counts as omitted.
  apiKey: z.string().trim().optional(),
});
export class UpdateLlmSettingsRequestDto extends createZodDto(UpdateLlmSettingsRequestSchema) {}

// The key is never echoed back, only the non-secret choice.
export const UpdateLlmSettingsResponseSchema = z.object({
  provider: LlmProvider,
  model: z.string(),
});
export class UpdateLlmSettingsResponseDto extends createZodDto(UpdateLlmSettingsResponseSchema) {}
