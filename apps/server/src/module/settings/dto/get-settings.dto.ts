import { LlmProvider } from '@diffy/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Secrets are deliberately absent: the response only says whether they are set.
export const GetSettingsResponseSchema = z.object({
  github: z.object({
    configured: z.boolean(),
    login: z.string().describe('The GitHub account the saved token belongs to').nullable(),
  }),
  llm: z.object({
    configured: z.boolean(),
    provider: LlmProvider.nullable(),
    model: z.string().describe('The model that is configured').nullable(),
  }),
});
export class GetSettingsResponseDto extends createZodDto(GetSettingsResponseSchema) {}
