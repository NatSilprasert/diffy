import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ReposModule } from '../repos/repos.module';
import { SettingsModule } from '../settings/settings.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepository } from './reviews.repository';
import { CreateReviewUsecase } from './usecase/create-review.usecase';
import { GetReviewStatsUsecase } from './usecase/get-review-stats.usecase';
import { GetUsageUsecase } from './usecase/get-usage.usecase';
import { GetReviewUsecase } from './usecase/get-review.usecase';
import { GetStatusUsecase } from './usecase/get-status.usecase';
import { ListReviewsUsecase } from './usecase/list-reviews.usecase';
import { PollRepoUsecase } from './usecase/poll-repo.usecase';
import { RetryReviewUsecase } from './usecase/retry-review.usecase';
import { PollerWorker } from './worker/poller.worker';
import { ReviewQueueWorker } from './worker/review-queue.worker';
import { RunReviewWorker } from './worker/run-review.worker';

@Module({
  imports: [ReposModule, SettingsModule, ProfilesModule, GithubModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsRepository,
    CreateReviewUsecase,
    ListReviewsUsecase,
    GetReviewUsecase,
    RetryReviewUsecase,
    PollRepoUsecase,
    GetStatusUsecase,
    GetReviewStatsUsecase,
    GetUsageUsecase,
    RunReviewWorker,
    ReviewQueueWorker,
    PollerWorker,
  ],
})
export class ReviewsModule {}
