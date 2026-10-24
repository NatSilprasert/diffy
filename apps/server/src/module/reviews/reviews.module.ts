import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { SettingsModule } from '../settings/settings.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepository } from './reviews.repository';
import { CreateReviewUsecase } from './usecase/create-review.usecase';
import { GetReviewUsecase } from './usecase/get-review.usecase';
import { ListReviewsUsecase } from './usecase/list-reviews.usecase';
import { RetryReviewUsecase } from './usecase/retry-review.usecase';
import { PollerService } from './worker/poller.service';
import { ReviewQueueService } from './worker/review-queue.service';
import { RunReviewService } from './worker/run-review.service';

@Module({
  imports: [ReposModule, SettingsModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsRepository,
    CreateReviewUsecase,
    ListReviewsUsecase,
    GetReviewUsecase,
    RetryReviewUsecase,
    RunReviewService,
    ReviewQueueService,
    PollerService,
  ],
})
export class ReviewsModule {}
