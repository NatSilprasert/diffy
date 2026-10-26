import { LlmProvider, ProfileStatus } from '@diffy/shared';
import { z } from 'zod';

// The profile of one repository as the API shows it. `content` is the part the model wrote, `notes` the part
// people wrote. Neither holds anything secret.
export const ProfileItemSchema = z.object({
  repositoryId: z.string(),
  status: ProfileStatus,
  content: z.string().describe('The profile the model wrote, as markdown; null before the first successful build').nullable(),
  notes: z.string(),
  error: z.string().describe('Why the last build failed; null when it did not').nullable(),
  branch: z.string().describe('The default branch the profile was built from').nullable(),
  builtCommit: z.string().describe('The head commit of that branch when the profile was built').nullable(),
  builtAt: z.iso.datetime().nullable(),
  provider: LlmProvider.nullable(),
  model: z.string().describe('The model that wrote the profile').nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
});
export type ProfileItem = z.infer<typeof ProfileItemSchema>;
