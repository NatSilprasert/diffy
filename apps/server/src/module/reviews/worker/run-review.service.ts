import { createGithubClient, getPullRequest, reviewPullRequest } from '@diffy/core';
import { Injectable, Logger } from '@nestjs/common';
import { redactSecrets } from '../../../infra/security/redact';
import { SettingsService } from '../../settings/settings.service';
import { ReviewsRepository } from '../reviews.repository';

const MAX_ERROR_CHARS = 2_000;

// Runs one queued review from start to finish. It never throws for a review that goes wrong: the
// failure is written to the review row, so the queue keeps going and the user can see what happened.
@Injectable()
export class RunReviewService {
  private readonly logger = new Logger(RunReviewService.name);

  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async run(reviewId: string): Promise<void> {
    const review = await this.reviewsRepository.findForRun(reviewId);
    if (!review) return;
    // Only the caller that wins this update runs the review; anything else is a no-op.
    if (!(await this.reviewsRepository.claim(reviewId))) return;

    const secrets: string[] = [];
    try {
      const token = await this.settingsService.getGithubToken();
      secrets.push(token);
      const llm = await this.settingsService.getLlmConfig();
      secrets.push(llm.apiKey);

      const { owner, name } = review.repository;
      const octokit = createGithubClient(token);
      const pr = await getPullRequest(octokit, owner, name, review.prNumber);

      // The review was queued for a specific commit. If the PR has moved on, the diff GitHub would
      // return is no longer that commit's, so do not post; the newer commit gets its own review.
      if (pr.headSha !== review.headSha) {
        await this.reviewsRepository.saveResult(reviewId, {
          status: 'skipped',
          summary: `Skipped: commit ${pr.headSha.slice(0, 7)} was pushed before this review ran. It is reviewed on its own.`,
          githubReviewUrl: null,
          provider: null,
          model: null,
          inputTokens: null,
          outputTokens: null,
          findings: [],
        });
        return;
      }

      const result = await reviewPullRequest({ octokit, pr, llm, post: true });
      const reviewed = result.outcome === 'posted';

      await this.reviewsRepository.saveResult(reviewId, {
        status: reviewed ? 'posted' : 'skipped',
        summary: result.summary,
        githubReviewUrl: result.githubReviewUrl ?? null,
        provider: reviewed ? llm.provider : null,
        model: reviewed ? llm.model : null,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        findings: result.findings,
      });
      this.logger.log(`Review ${reviewId} ${result.outcome}: ${result.findings.length} finding(s)`);
    } catch (err) {
      const message = redactSecrets(err instanceof Error ? err.message : String(err), secrets);
      this.logger.warn(`Review ${reviewId} failed: ${message}`);
      await this.reviewsRepository.markFailed(reviewId, message.slice(0, MAX_ERROR_CHARS));
    }
  }
}
