import { z } from 'zod';

// The shape of one watched repository, shared by the endpoints that return it.
export const RepoItemSchema = z.object({
  id: z.string(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type RepoItem = z.infer<typeof RepoItemSchema>;
