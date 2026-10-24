import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { SettingsModule } from '../settings/settings.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsRepository } from './reviews.repository';
import { CreateReviewUsecase } from './usecase/create-review.usecase';

@Module({
  imports: [ReposModule, SettingsModule],
  controllers: [ReviewsController],
  providers: [ReviewsRepository, CreateReviewUsecase],
})
export class ReviewsModule {}
