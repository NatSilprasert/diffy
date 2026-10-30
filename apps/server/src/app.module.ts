import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthGuard } from './infra/auth/auth.guard';
import { ConfigModule } from './infra/config/config.module';
import { CryptoModule } from './infra/crypto/crypto.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './module/auth/auth.module';
import { HealthModule } from './module/health/health.module';
import { ProfilesModule } from './module/profiles/profiles.module';
import { ReposModule } from './module/repos/repos.module';
import { ReviewsModule } from './module/reviews/reviews.module';
import { SettingsModule } from './module/settings/settings.module';
import { WebhooksModule } from './module/webhooks/webhooks.module';

@Module({
  imports: [ConfigModule, PrismaModule, CryptoModule, HealthModule, AuthModule, SettingsModule, ReposModule, ProfilesModule, ReviewsModule, WebhooksModule],
  providers: [
    // Every route asks for a signed-in person unless it says @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
    // Validates every request body/query/param against its Zod DTO.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Strips every response down to its DTO schema, so fields like encrypted keys cannot leak.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
