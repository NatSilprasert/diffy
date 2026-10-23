import { Module } from '@nestjs/common';
import { ConfigModule } from './infra/config/config.module';
import { HealthModule } from './module/health/health.module';

@Module({ imports: [ConfigModule, HealthModule] })
export class AppModule {}
