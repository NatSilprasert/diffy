import { Injectable } from '@nestjs/common';
import { GithubService } from '../github/github.service';
import { SettingsService } from '../settings/settings.service';
import { ProfilesRepository } from './profiles.repository';
import { ProfileBuilderWorker } from './worker/profile-builder.worker';
import { ProfileFreshnessWorker } from './worker/profile-freshness.worker';

// What a review gets to know about its repository: the profile the model wrote (only once it is ready) and the
// notes people wrote.
export type ReviewContext = { profile: string | undefined; notes: string | undefined };

// The profiles module's public API for other modules (the poller and the review worker).
@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly builder: ProfileBuilderWorker,
    private readonly settingsService: SettingsService,
    private readonly githubService: GithubService,
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

  // Starts a profile for every one of these repositories that has none yet. Does nothing until GitHub and the model
  // are set up, so a repository added first is picked up as soon as Settings are complete. A profile that failed
  // is not started again here: a failure may cost a model call, so a person decides when to retry (Rebuild).
  async startMissing(repositoryIds: string[]): Promise<void> {
    if (repositoryIds.length === 0 || !(await this.settingsService.isConfigured({ githubViaApp: this.githubService.isAppMode() }))) return;
    const have = new Set(await this.profilesRepository.findRepositoryIdsWithProfile(repositoryIds));
    for (const repositoryId of repositoryIds) {
      if (have.has(repositoryId)) continue;
      if (await this.profilesRepository.createBuilding(repositoryId)) this.builder.enqueue(repositoryId);
    }
  }

  // Builds again the profiles of these repositories whose project changed a lot since (at most one look per
  // repository per day). Does nothing until GitHub and the model are set up.
  async refreshStale(repositoryIds: string[]): Promise<void> {
    if (repositoryIds.length === 0 || !(await this.settingsService.isConfigured({ githubViaApp: this.githubService.isAppMode() }))) return;
    await this.freshness.checkAll(repositoryIds);
  }
}
