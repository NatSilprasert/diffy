import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { ReceiveWebhookUsecase } from './usecase/receive-webhook.usecase';

@Module({
  controllers: [GithubController],
  providers: [GithubRepository, ReceiveWebhookUsecase],
})
export class GithubModule {}
