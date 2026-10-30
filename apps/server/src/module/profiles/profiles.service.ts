import { Injectable } from '@nestjs/common';
import type { WatchedRepo } from '../repos/repos.service';
import { SettingsService } from '../settings/settings.service';
import { ProfilesRepository } from './profiles.repository';
import { ProfileBuilderWorker } from './worker/profile-builder.worker';
import { ProfileFreshnessWorker } from './worker/profile-freshness.worker';

// What a review gets to know about its repository: the profile the model wrote (only once it is ready) and the
// notes people wrote.
export type ReviewContext = { profile: string | undefined; notes: string | undefined };

// The profiles module's public API for other modules (the maintenance worker and the review worker).
@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly builder: ProfileBuilderWorker,
    private readonly settingsService: SettingsService,
    private readonly freshness: ProfileFreshnessWorker,
  ) {}

  async getReviewContext(repositoryId: string): Promise<ReviewContext> {
    const profile = await this.profilesRepository.findByRepositoryId(repositoryId);
    return {
      // A failed rebuild keeps the old content, which is still the best description there is.
      profile: profile?.content?.trim() || undefined,
      notes: profile?.notes.trim() || undefined,
    };
  }

  // Starts a profile for every one of these repositories that has none yet. Skips a repository whose account has not
  // set up its model, so it is picked up as soon as they do. A profile that failed is not started again here: a
  // failure may cost a model call, so a person decides when to retry (Rebuild).
  async startMissing(repos: WatchedRepo[]): Promise<void> {
    const ready = await this.withModel(repos);
    if (ready.length === 0) return;
    const ids = ready.map((repo) => repo.id);
    const have = new Set(await this.profilesRepository.findRepositoryIdsWithProfile(ids));
    for (const repositoryId of ids) {
      if (have.has(repositoryId)) continue;
      if (await this.profilesRepository.createBuilding(repositoryId)) this.builder.enqueue(repositoryId);
    }
  }

  // Builds again the profiles of these repositories whose project changed a lot since (at most one look per
  // repository per day). Skips a repository whose account has not set up its model.
  async refreshStale(repos: WatchedRepo[]): Promise<void> {
    const ready = await this.withModel(repos);
    if (ready.length > 0) await this.freshness.checkAll(ready.map((repo) => repo.id));
  }

  // The repositories whose account has a model to build a profile with (asked once per account).
  private async withModel(repos: WatchedRepo[]): Promise<WatchedRepo[]> {
    const configured = new Map<string, boolean>();
    for (const accountId of new Set(repos.map((repo) => repo.accountId))) {
      configured.set(accountId, await this.settingsService.isLlmConfigured(accountId));
    }
    return repos.filter((repo) => configured.get(repo.accountId));
  }
}
