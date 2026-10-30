import { LlmProvider } from '@diffy/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Secrets are deliberately absent: the response only says whether they are set.
export const GetSettingsResponseSchema = z.object({
  github: z.object({
    configured: z.boolean().describe('Whether diffy has an installation of its GitHub App to work with'),
    appName: z.string().describe('The name of the diffy GitHub App, the "[bot]" that posts reviews').nullable(),
    installUrl: z.string().describe('Where to install the App on another account or give it more repositories').nullable(),
    accounts: z
      .array(
        z.object({
          login: z.string().describe('The user or organization the App is installed on'),
          type: z.string().describe('"User" or "Organization"'),
          repositorySelection: z.enum(['all', 'selected']).describe('Every repository of the account, or only chosen ones'),
        }),
      )
      .describe('Where the App is installed now'),
  }),
  llm: z.object({
    configured: z.boolean(),
    provider: LlmProvider.nullable(),
    model: z.string().describe('The model that is configured').nullable(),
  }),
});
export class GetSettingsResponseDto extends createZodDto(GetSettingsResponseSchema) {}
