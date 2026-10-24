import type { Repository } from '../../generated/prisma/client';
import type { RepoItem } from './dto/repo-item.schema';

export function toRepoItem(repo: Repository): RepoItem {
  return {
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    fullName: `${repo.owner}/${repo.name}`,
    enabled: repo.enabled,
    lastPolledAt: repo.lastPolledAt?.toISOString() ?? null,
    lastError: repo.lastError,
    createdAt: repo.createdAt.toISOString(),
  };
}
