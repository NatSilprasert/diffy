import { getRepository, listOpenPullRequests, type RepositoryInfo } from '@diffy/core';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GithubService } from '../github/github.service';
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
  private readonly logger = new Logger(ReposService.name);

  constructor(
    private readonly reposRepository: ReposRepository,
    private readonly githubService: GithubService,
  ) {}

  // A repository, whoever it belongs to: for the workers, which serve every account. A request from a person goes
  // through getAccountRepo instead. Unknown and removed ids are both "not found".
  async getActiveRepo(id: string): Promise<WatchedRepo> {
    const repo = await this.reposRepository.findActiveById(id);
    if (!repo) throw new NotFoundException('Repository not found.');
    return toWatchedRepo(repo);
  }

  // A repository the account is watching. Someone else's repository is "not found" too: nothing says it exists.
  async getAccountRepo(id: string, accountId: string): Promise<WatchedRepo> {
    const repo = await this.reposRepository.findActiveOfAccount(id, accountId);
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

  // Checks a repository with GitHub and notes the head commit of every pull request that is open right now. Those are
  // the baseline: not reviewed automatically, otherwise watching a repository would review all of its open pull
  // requests at once. Throws what GitHub throws; the caller decides what that means.
  async lookupOnGithub(owner: string, name: string): Promise<{ info: RepositoryInfo; baselineShas: string[] }> {
    const { octokit } = await this.githubService.getAccess(owner, name);
    const info = await getRepository(octokit, owner, name);
    const openPulls = await listOpenPullRequests(octokit, info.owner, info.name);
    return { info, baselineShas: openPulls.map((pr) => pr.headSha) };
  }

  // Starts watching repositories the account gave the App, without anyone clicking Add. One that cannot be read (or is
  // archived, which GitHub does not allow reviews on) is skipped and logged, never a reason to leave the others. A
  // repository the person removed earlier comes back: giving the App access again is asking for it. Returns how many
  // started being watched.
  async autoWatch(accountId: string, repos: Array<{ owner: string; name: string }>): Promise<number> {
    let started = 0;
    for (const { owner, name } of repos) {
      try {
        const { info, baselineShas } = await this.lookupOnGithub(owner, name);
        if (info.archived) continue;
        const created = await this.reposRepository.add({ accountId, owner: info.owner, name: info.name, baselineShas });
        if (created) started++;
      } catch (err) {
        this.logger.warn(`Could not start watching ${owner}/${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return started;
  }

  // Stops watching repositories the account took the App away from. Their review history stays.
  unwatch(accountId: string, repos: Array<{ owner: string; name: string }>): Promise<number> {
    return this.reposRepository.softRemoveByName(accountId, repos);
  }

  // Stops watching everything of an account (the App was uninstalled).
  unwatchAll(accountId: string): Promise<number> {
    return this.reposRepository.softRemoveAllOfAccount(accountId);
  }
}
