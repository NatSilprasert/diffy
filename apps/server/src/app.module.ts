import { Module } from '@nestjs/common';
import { ConfigModule } from './infra/config/config.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { HealthModule } from './module/health/health.module';

@Module({ imports: [ConfigModule, PrismaModule, HealthModule] })
export class AppModule {}
