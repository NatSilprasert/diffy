import { z } from 'zod';

export const AuthViewSchema = z.object({
  user: z.object({
    login: z.string(),
    name: z.string().describe('The name the person gave on GitHub').nullable(),
    avatarUrl: z.string().nullable(),
  }),
  accounts: z
    .array(z.object({ id: z.string(), login: z.string(), type: z.string().describe('"User" or "Organization"') }))
    .describe('The accounts the person can use diffy for'),
  currentAccountId: z.string().describe('The account being looked at now; null when there is none yet').nullable(),
});
export type AuthView = z.infer<typeof AuthViewSchema>;
