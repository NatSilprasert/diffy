import { createGithubClient, getPullRequest, type PullRequestInfo } from '@diffy/core';
import { Injectable } from '@nestjs/common';
import { toGithubHttpException } from '../../../infra/github/github-errors';
import { ReposService } from '../../repos/repos.service';
import { SettingsService } from '../../settings/settings.service';
import type { CreateReviewRequestDto, CreateReviewResponseDto } from '../dto/create-review.dto';
import { toReviewItem } from '../reviews.mapper';
import { ReviewsRepository } from '../reviews.repository';

@Injectable()
export class CreateReviewUsecase {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reposService: ReposService,
    private readonly settingsService: SettingsService,
  ) {}

  async execute(input: CreateReviewRequestDto): Promise<CreateReviewResponseDto> {
    const repo = await this.reposService.getActiveRepo(input.repositoryId);
    const pr = await this.fetchPullRequest(repo.owner, repo.name, input.prNumber);

    const { review, created } = await this.reviewsRepository.createQueued({
      repositoryId: repo.id,
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.url,
      headSha: pr.headSha,
    });
    return { skipped: !created, review: toReviewItem(review) };
  }

  // The head commit is read from GitHub now, so the review is tied to exactly what was current.
  private async fetchPullRequest(owner: string, name: string, number: number): Promise<PullRequestInfo> {
    const token = await this.settingsService.getGithubToken();
    try {
      return await getPullRequest(createGithubClient(token), owner, name, number);
    } catch (err) {
      throw toGithubHttpException(err, {
        notFound: `Pull request #${number} was not found in ${owner}/${name}, or the saved token cannot access it.`,
        rejected: 'GitHub rejected the saved token. Enter a new one in Settings.',
        unreachable: 'Could not reach GitHub to read the pull request. Try again in a moment.',
      });
    }
  }
}
