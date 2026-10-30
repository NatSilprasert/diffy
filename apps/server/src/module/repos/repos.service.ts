import { Injectable, NotFoundException } from '@nestjs/common';
import { ReposRepository } from './repos.repository';

// What other modules get to know about a repository: enough to talk to GitHub and to poll it.
export type WatchedRepo = {
  id: string;
  // The account the repository belongs to: its model settings are the ones used to review it.
  accountId: string;
  owner: string;
  name: string;
  // Head commits that already existed when the repo was added; the poller does not review these.
  baselineShas: string[];
};

const toWatchedRepo = (repo: { id: string; accountId: string; owner: string; name: string; baselineShas: string[] }): WatchedRepo => ({
  id: repo.id,
  accountId: repo.accountId,
  owner: repo.owner,
  name: repo.name,
  baselineShas: repo.baselineShas,
});

// The repos module's public API for other modules (reviews now, the poller later).
@Injectable()
export class ReposService {
  constructor(private readonly reposRepository: ReposRepository) {}

  // A repository the user is watching. Unknown and removed ids are both "not found".
  async getActiveRepo(id: string): Promise<WatchedRepo> {
    const repo = await this.reposRepository.findActiveById(id);
    if (!repo) throw new NotFoundException('Repository not found.');
    return toWatchedRepo(repo);
  }

  // The repositories to poll for new pull requests.
  async listPollableRepos(): Promise<WatchedRepo[]> {
    const repos = await this.reposRepository.findPollable();
    return repos.map(toWatchedRepo);
  }

  // The watched repository with this name, or null when diffy is not meant to review it.
  async findPollableRepo(owner: string, name: string): Promise<WatchedRepo | null> {
    const repo = await this.reposRepository.findPollableByName(owner, name);
    return repo ? toWatchedRepo(repo) : null;
  }

  // "owner/name" for each id, removed repositories included. Unknown ids are simply missing from the map.
  async getFullNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const repos = await this.reposRepository.findNamesByIds(ids);
    return new Map(repos.map((repo) => [repo.id, `${repo.owner}/${repo.name}`]));
  }

  // Remember when a repository was last polled, and why it failed (null = it went fine).
  recordPoll(id: string, error: string | null): Promise<void> {
    return this.reposRepository.markPolled(id, error);
  }
}
