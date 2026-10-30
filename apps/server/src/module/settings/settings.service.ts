import type { LlmConfig } from '@diffy/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { SettingsRepository } from './settings.repository';

// The settings module's public API for other modules (the review worker and the profile builder).
// Other modules inject this service, never SettingsRepository, and secrets never leave the server.
@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  // Whether the account has set up its model, without decrypting anything. For work that should wait until then.
  async isLlmConfigured(accountId: string): Promise<boolean> {
    const settings = await this.settingsRepository.findByAccountId(accountId);
    return Boolean(settings?.llmProvider && settings.llmModel && settings.llmApiKeyEnc);
  }

  // The saved LLM choice of an account with its key in plain text, ready to hand to @diffy/core.
  async getLlmConfig(accountId: string): Promise<LlmConfig> {
    const settings = await this.settingsRepository.findByAccountId(accountId);
    if (!settings?.llmProvider || !settings.llmModel || !settings.llmApiKeyEnc) {
      throw new BadRequestException('Save an LLM provider, model and API key in Settings first.');
    }
    try {
      return {
        provider: settings.llmProvider,
        model: settings.llmModel,
        apiKey: this.crypto.decrypt(settings.llmApiKeyEnc),
      };
    } catch {
      throw new BadRequestException(
        'The saved LLM API key cannot be decrypted (was ENCRYPTION_KEY changed?). Enter the key again.',
      );
    }
  }
}
