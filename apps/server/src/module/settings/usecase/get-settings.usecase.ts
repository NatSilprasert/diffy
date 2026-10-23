import { Injectable } from '@nestjs/common';
import type { GetSettingsResponseDto } from '../dto/get-settings.dto';
import { toApiProvider } from '../llm-provider.mapper';
import { SettingsRepository } from '../settings.repository';

@Injectable()
export class GetSettingsUsecase {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async execute(): Promise<GetSettingsResponseDto> {
    const settings = await this.settingsRepository.findSingleton();

    // Fields are copied one by one on purpose, so an encrypted column can never leak by accident.
    return {
      github: {
        configured: settings?.githubTokenEnc != null,
        login: settings?.githubLogin ?? null,
      },
      llm: {
        configured: settings?.llmProvider != null && settings.llmModel != null && settings.llmApiKeyEnc != null,
        provider: settings?.llmProvider ? toApiProvider(settings.llmProvider) : null,
        model: settings?.llmModel ?? null,
      },
    };
  }
}
