import { checkProfileFreshness } from '@diffy/core';
import { Injectable, Logger } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import { GithubService } from '../../github/github.service';
import { ProfilesRepository } from '../profiles.repository';
import { ProfileBuilderWorker } from './profile-builder.worker';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

// A brief is looked at again at most this often, per repository.
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;

// Keeps the project briefs up to date: once a day per repository it asks GitHub what changed since the brief was
// built, and builds it again when the project's rules, documents or configuration changed (or very many files did).
// When it last looked is kept in memory, so a restart may look once more; that is one cheap GitHub call.
@Injectable()
export class ProfileFreshnessWorker {
  private readonly logger = new Logger(ProfileFreshnessWorker.name);
  private readonly checkedAt = new Map<string, number>();

  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly reposService: ReposService,
    private readonly githubService: GithubService,
    private readonly builder: ProfileBuilderWorker,
  ) {}

  // Never throws: one repository that cannot be checked must not stop the others, or the poll that called this.
  async checkAll(repositoryIds: string[], now: number = Date.now()): Promise<void> {
    for (const repositoryId of repositoryIds) {
      const last = this.checkedAt.get(repositoryId);
      if (last !== undefined && now - last < CHECK_EVERY_MS) continue;
      try {
        await this.check(repositoryId, now);
      } catch (err) {
        this.logger.warn(`Could not check whether the brief of ${repositoryId} is up to date: ${errorMessage(err)}`);
      }
    }
  }

  private async check(repositoryId: string, now: number): Promise<void> {
    const profile = await this.profilesRepository.findByRepositoryId(repositoryId);
    // Only a finished brief can be old. One being built, or one that failed, is for a person to look at.
    if (profile?.status !== 'ready' || !profile.builtCommit || !profile.branch || !profile.builtAt) return;
    // Built less than a day ago: nothing to compare yet, and not worth a GitHub call.
    if (now - profile.builtAt.getTime() < CHECK_EVERY_MS) return;

    const repo = await this.reposService.getActiveRepo(repositoryId);
    const { octokit } = await this.githubService.getAccess(repo.owner, repo.name);
    const freshness = await checkProfileFreshness(octokit, repo.owner, repo.name, profile.branch, profile.builtCommit);
    this.checkedAt.set(repositoryId, now);

    if (!freshness.stale) return;
    if (await this.profilesRepository.markBuildingIfIdle(repositoryId)) {
      this.logger.log(`Brief of ${repo.owner}/${repo.name} is out of date (${freshness.reason}); building it again`);
      this.builder.enqueue(repositoryId);
    }
  }
}
