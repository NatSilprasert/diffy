import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { ConfigModule } from './infra/config/config.module';
import { CryptoModule } from './infra/crypto/crypto.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { HealthModule } from './module/health/health.module';
import { SettingsModule } from './module/settings/settings.module';

@Module({
  imports: [ConfigModule, PrismaModule, CryptoModule, HealthModule, SettingsModule],
  providers: [
    // Validates every request body/query/param against its Zod DTO.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Strips every response down to its DTO schema, so fields like encrypted keys cannot leak.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
