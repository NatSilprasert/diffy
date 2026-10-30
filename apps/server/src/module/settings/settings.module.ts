import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { GetSettingsUsecase } from './usecase/get-settings.usecase';
import { TestLlmSettingsUsecase } from './usecase/test-llm-settings.usecase';
import { UpdateLlmSettingsUsecase } from './usecase/update-llm-settings.usecase';

@Module({
  imports: [GithubModule],
  controllers: [SettingsController],
  providers: [
    SettingsRepository,
    GetSettingsUsecase,
    UpdateLlmSettingsUsecase,
    TestLlmSettingsUsecase,
    SettingsService,
  ],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [SettingsService],
})
export class SettingsModule {}
