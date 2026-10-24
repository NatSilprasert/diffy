import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { GetSettingsUsecase } from './usecase/get-settings.usecase';
import { TestLlmSettingsUsecase } from './usecase/test-llm-settings.usecase';
import { UpdateGithubSettingsUsecase } from './usecase/update-github-settings.usecase';
import { UpdateLlmSettingsUsecase } from './usecase/update-llm-settings.usecase';

@Module({
  controllers: [SettingsController],
  providers: [
    SettingsRepository,
    GetSettingsUsecase,
    UpdateGithubSettingsUsecase,
    UpdateLlmSettingsUsecase,
    TestLlmSettingsUsecase,
    SettingsService,
  ],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [SettingsService],
})
export class SettingsModule {}
