import type { RepoProfile } from '../../generated/prisma/client';
import type { ProfileItem } from './dto/profile-item.schema';

// Enum values are spelled the same in the database and in the API, so they pass through as they are.
export function toProfileItem(profile: RepoProfile): ProfileItem {
  return {
    repositoryId: profile.repositoryId,
    status: profile.status,
    content: profile.content,
    notes: profile.notes,
    error: profile.error,
    branch: profile.branch,
    builtCommit: profile.builtCommit,
    builtAt: profile.builtAt?.toISOString() ?? null,
    provider: profile.provider,
    model: profile.model,
    inputTokens: profile.inputTokens,
    outputTokens: profile.outputTokens,
  };
}
