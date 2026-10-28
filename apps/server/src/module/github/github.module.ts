import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { ReceiveWebhookUsecase } from './usecase/receive-webhook.usecase';

@Module({
  imports: [SettingsModule],
  controllers: [GithubController],
  providers: [GithubRepository, GithubService, ReceiveWebhookUsecase],
  // Only the access service is public: other modules get a GitHub client from it and never see how it is made.
  exports: [GithubService],
})
export class GithubModule {}
