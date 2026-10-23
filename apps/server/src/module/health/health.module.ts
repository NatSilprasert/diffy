import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthRepository } from './health.repository';
import { GetHealthUsecase } from './usecase/get-health.usecase';

@Module({
  controllers: [HealthController],
  providers: [HealthRepository, GetHealthUsecase],
})
export class HealthModule {}
