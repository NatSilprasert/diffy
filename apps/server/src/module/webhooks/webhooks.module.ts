import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { GithubModule } from '../github/github.module';
import { ReposModule } from '../repos/repos.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ReceiveWebhookUsecase } from './usecase/receive-webhook.usecase';
import { WebhooksController } from './webhooks.controller';

// Everything GitHub sends to diffy. It needs the other modules' public services, so it sits above them.
@Module({
  imports: [AccountsModule, AuthModule, GithubModule, ReposModule, ReviewsModule],
  controllers: [WebhooksController],
  providers: [ReceiveWebhookUsecase],
})
export class WebhooksModule {}
