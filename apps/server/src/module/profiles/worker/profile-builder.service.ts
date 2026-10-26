import { buildProjectProfile, createGithubClient } from '@diffy/core';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { redactSecrets } from '../../../infra/security/redact';
import { ReposService } from '../../repos/repos.service';
import { SettingsService } from '../../settings/settings.service';
import { ProfilesRepository } from '../profiles.repository';

const MAX_ERROR_CHARS = 2_000;

// Builds the project profiles, one at a time (each one is a few dozen GitHub calls and one model call).
// Like the review queue it lives in memory; a build that was running when the server stopped starts again on boot.
@Injectable()
export class ProfileBuilderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProfileBuilderService.name);
  private queue: string[] = [];
  private running = false;

  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly reposService: ReposService,
    private readonly settingsService: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const repositoryId of await this.profilesRepository.findBuildingRepositoryIds()) this.enqueue(repositoryId);
  }

  // A repository that is already waiting is not queued twice.
  enqueue(repositoryId: string): void {
    if (!this.queue.includes(repositoryId)) this.queue.push(repositoryId);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let next = this.queue.shift(); next !== undefined; next = this.queue.shift()) await this.run(next);
    } finally {
      this.running = false;
    }
  }

  // Never throws: a build that goes wrong is written to the profile, so the queue keeps going and the user sees why.
  async run(repositoryId: string): Promise<void> {
    const secrets: string[] = [];
    try {
      const profile = await this.profilesRepository.findByRepositoryId(repositoryId);
      if (profile?.status !== 'building') return;

      const repo = await this.reposService.getActiveRepo(repositoryId);
      const token = await this.settingsService.getGithubToken();
      secrets.push(token);
      const llm = await this.settingsService.getLlmConfig();
      secrets.push(llm.apiKey);

      const built = await buildProjectProfile({ octokit: createGithubClient(token), owner: repo.owner, repo: repo.name, llm });
      await this.profilesRepository.saveBuilt(repositoryId, {
        content: built.content,
        branch: built.branch,
        builtCommit: built.commit,
        provider: llm.provider,
        model: llm.model,
        inputTokens: built.usage.inputTokens ?? null,
        outputTokens: built.usage.outputTokens ?? null,
      });
      this.logger.log(`Profile of ${repo.owner}/${repo.name} ready: ${built.filesRead.length} file(s) read, ${built.dropped} rule(s) dropped`);
    } catch (err) {
      const message = redactSecrets(err instanceof Error ? err.message : String(err), secrets);
      this.logger.warn(`Profile ${repositoryId} failed: ${message}`);
      await this.profilesRepository.markFailed(repositoryId, message.slice(0, MAX_ERROR_CHARS)).catch((writeErr) => {
        this.logger.error(`Could not record the failure of profile ${repositoryId}: ${writeErr instanceof Error ? writeErr.message : writeErr}`);
      });
    }
  }
}
