import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { GetSettingsUsecase } from './usecase/get-settings.usecase';
import { TestLlmSettingsUsecase } from './usecase/test-llm-settings.usecase';
import { UpdateGithubSettingsUsecase } from './usecase/update-github-settings.usecase';
import { UpdateLlmSettingsUsecase } from './usecase/update-llm-settings.usecase';

@Module({
  controllers: [SettingsController],
  providers: [SettingsRepository, GetSettingsUsecase, UpdateGithubSettingsUsecase, UpdateLlmSettingsUsecase, TestLlmSettingsUsecase],
  // The review worker (Phase E) loads and decrypts the saved credentials through the repository.
  exports: [SettingsRepository],
})
export class SettingsModule {}
