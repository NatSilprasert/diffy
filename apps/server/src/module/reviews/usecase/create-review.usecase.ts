import { getPullRequest, type PullRequestInfo } from '@diffy/core';
import { Injectable } from '@nestjs/common';
import { toGithubHttpException } from '../../../infra/github/github-errors';
import { ReposService } from '../../repos/repos.service';
import { GithubService } from '../../github/github.service';
import type { CreateReviewRequestDto, CreateReviewResponseDto } from '../dto/create-review.dto';
import { toReviewItem } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';
import { ReviewQueueWorker } from '../worker/review-queue.worker';

@Injectable()
export class CreateReviewUsecase {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reposService: ReposService,
    private readonly githubService: GithubService,
    private readonly reviewQueue: ReviewQueueWorker,
  ) {}

  async execute(accountId: string, input: CreateReviewRequestDto): Promise<CreateReviewResponseDto> {
    const repo = await this.reposService.getAccountRepo(input.repositoryId, accountId);
    const pr = await this.fetchPullRequest(repo.owner, repo.name, input.prNumber);

    const { review, created } = await this.reviewsRepository.createQueued({
      repositoryId: repo.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.url,
      headSha: pr.headSha,
    });
    // Only a brand-new row is queued; an existing one is already queued, running or finished.
    if (created) this.reviewQueue.enqueue(review.id);
    return { skipped: !created, review: toReviewItem(review) };
  }

  // The head commit is read from GitHub now, so the review is tied to exactly what was current.
  private async fetchPullRequest(owner: string, name: string, number: number): Promise<PullRequestInfo> {
    try {
      const { octokit } = await this.githubService.getAccess(owner, name);
      return await getPullRequest(octokit, owner, name, number);
    } catch (err) {
      throw toGithubHttpException(err, {
        notFound: `Pull request #${number} was not found in ${owner}/${name}, or the diffy GitHub App is not installed on that repository.`,
        rejected: 'GitHub rejected the diffy GitHub App. Check its settings on GitHub.',
        unreachable: 'Could not reach GitHub to read the pull request. Try again in a moment.',
      });
    }
  }
}
