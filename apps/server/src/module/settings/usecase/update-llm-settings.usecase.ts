import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '../../../infra/crypto/crypto.service';
import type { UpdateLlmSettingsRequestDto, UpdateLlmSettingsResponseDto } from '../dto/update-llm-settings.dto';
import { SettingsRepository } from '../settings.repository';

@Injectable()
export class UpdateLlmSettingsUsecase {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  async execute(input: UpdateLlmSettingsRequestDto): Promise<UpdateLlmSettingsResponseDto> {
    const llmApiKeyEnc = await this.resolveApiKey(input);

    await this.settingsRepository.upsertLlm({
      llmProvider: input.provider,
      llmModel: input.model,
      llmApiKeyEnc,
    });
    return { provider: input.provider, model: input.model };
  }

  // A new key is encrypted. Without one, the saved key is only reused when it belongs to the same
  // provider: a key for one provider is useless (and misleading) for another.
  private async resolveApiKey(input: UpdateLlmSettingsRequestDto): Promise<string> {
    if (input.apiKey) return this.crypto.encrypt(input.apiKey);

    const current = await this.settingsRepository.findSingleton();
    const sameProvider = current?.llmProvider === input.provider;
    if (sameProvider && current?.llmApiKeyEnc) return current.llmApiKeyEnc;

    throw new BadRequestException(
      current?.llmProvider != null && !sameProvider
        ? 'An API key is required when you change the provider.'
        : 'An API key is required.',
    );
  }
}
