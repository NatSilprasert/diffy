import { listOpenPullRequests } from '@diffy/core';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ENV } from '../../../infra/config/config.module';
import type { Env } from '../../../infra/config/env';
import { ProfilesService } from '../../profiles/profiles.service';
import { ReposService, type WatchedRepo } from '../../repos/repos.service';
import { GithubService } from '../../github/github.service';
import { isReviewable } from '../review-eligibility';
import { ReviewsRepository } from '../reviews.repository';
import { ReviewQueueWorker } from './review-queue.worker';

const MAX_ERROR_CHARS = 500;

type PolledRepo = Pick<WatchedRepo, 'id' | 'owner' | 'name' | 'baselineShas'>;

export type PollerState = {
  intervalSeconds: number;
  // A timer-driven pass over all repositories is running right now.
  running: boolean;
  // When the last timer-driven pass finished; null before the first one.
  lastRunAt: Date | null;
  // When the timer is due to fire next; null if it is not running.
  nextRunAt: Date | null;
};

export type PollResult = {
  // How many reviews this poll queued.
  queued: number;
  // Why the poll failed, or null if it went fine.
  error: string | null;
};

// Looks for new pull requests (and new commits on old ones) in every watched repository, on a timer,
// and queues a review for each commit that has none yet. No webhooks: a plain poll is enough.
@Injectable()
export class PollerWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PollerWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private polling = false;
  private lastTickAt: Date | null = null;
  private lastRunAt: Date | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly reposService: ReposService,
    private readonly githubService: GithubService,
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reviewQueue: ReviewQueueWorker,
    private readonly profilesService: ProfilesService,
  ) {}

  onApplicationBootstrap(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), this.env.POLL_INTERVAL_SECONDS * 1000);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  getState(): PollerState {
    const intervalMs = this.env.POLL_INTERVAL_SECONDS * 1000;
    return {
      intervalSeconds: this.env.POLL_INTERVAL_SECONDS,
      running: this.polling,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.timer && this.lastTickAt ? new Date(this.lastTickAt.getTime() + intervalMs) : null,
    };
  }

  private tick(): void {
    this.lastTickAt = new Date();
    void this.pollAll();
  }

  // One pass over every pollable repository, one after the other (gentle on GitHub's rate limit).
  // A pass that is still running when the timer fires again is not started twice.
  async pollAll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const repos = await this.reposService.listPollableRepos();
      await this.maintainProfiles(repos);
      for (const repo of repos) {
        try {
          await this.pollRepo(repo);
        } catch (err) {
          this.logger.error(`Could not record the poll of ${repo.owner}/${repo.name}: ${errorMessage(err)}`);
        }
      }
    } catch (err) {
      this.logger.error(`Poll failed: ${errorMessage(err)}`);
    } finally {
      this.polling = false;
      this.lastRunAt = new Date();
    }
  }

  // A watched repository that has no project profile yet gets one built in the background, and one whose project
  // changed a lot is built again. It must never stop the poll.
  private async maintainProfiles(repos: WatchedRepo[]): Promise<void> {
    try {
      await this.profilesService.startMissing(repos);
      await this.profilesService.refreshStale(repos);
    } catch (err) {
      this.logger.error(`Could not maintain the project profiles: ${errorMessage(err)}`);
    }
  }

  // Polls one repository. A failure is written to the repository (lastError) and returned, not thrown,
  // so one broken repository never stops the others.
  async pollRepo(repo: PolledRepo): Promise<PollResult> {
    try {
      const { octokit } = await this.githubService.getAccess(repo.owner, repo.name);
      const pulls = await listOpenPullRequests(octokit, repo.owner, repo.name);

      let queued = 0;
      for (const pr of pulls) {
        if (!isReviewable(pr, repo.baselineShas)) continue;

        const { review, created } = await this.reviewsRepository.createQueued({
          repositoryId: repo.id,
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.url,
          headSha: pr.headSha,
        });
        if (created) {
          this.reviewQueue.enqueue(review.id);
          queued++;
        }
      }

      await this.reposService.recordPoll(repo.id, null);
      if (queued > 0) this.logger.log(`${repo.owner}/${repo.name}: queued ${queued} review(s)`);
      return { queued, error: null };
    } catch (err) {
      const message = errorMessage(err).slice(0, MAX_ERROR_CHARS);
      this.logger.warn(`${repo.owner}/${repo.name}: poll failed: ${message}`);
      await this.reposService.recordPoll(repo.id, message);
      return { queued: 0, error: message };
    }
  }
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
