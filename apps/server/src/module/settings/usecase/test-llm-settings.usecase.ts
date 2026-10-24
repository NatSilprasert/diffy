import { pingLlm } from '@diffy/core';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '../../../infra/crypto/crypto.service';
import type { TestLlmSettingsResponseDto } from '../dto/test-llm-settings.dto';
import { toApiProvider } from '../settings.mapper';
import { SettingsRepository } from '../settings.repository';

const TEST_TIMEOUT_MS = 60_000;

@Injectable()
export class TestLlmSettingsUsecase {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  async execute(): Promise<TestLlmSettingsResponseDto> {
    const settings = await this.settingsRepository.findSingleton();
    if (!settings?.llmProvider || !settings.llmModel || !settings.llmApiKeyEnc) {
      throw new BadRequestException('Save an LLM provider, model and API key first.');
    }

    let apiKey: string;
    try {
      apiKey = this.crypto.decrypt(settings.llmApiKeyEnc);
    } catch {
      return {
        ok: false,
        error: 'The saved API key cannot be decrypted (was ENCRYPTION_KEY changed?). Enter the key again.',
        latencyMs: null,
      };
    }

    const startedAt = Date.now();
    try {
      await pingLlm({
        provider: toApiProvider(settings.llmProvider),
        model: settings.llmModel,
        apiKey,
        timeoutMs: TEST_TIMEOUT_MS,
      });
      return { ok: true, error: null, latencyMs: Date.now() - startedAt };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: redact(message, apiKey), latencyMs: Date.now() - startedAt };
    }
  }
}

// Some providers echo the key back inside their error message. It must not reach the browser.
function redact(message: string, secret: string): string {
  return secret.length < 6 ? message : message.split(secret).join('***');
}
