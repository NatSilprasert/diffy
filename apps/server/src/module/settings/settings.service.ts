import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { SettingsRepository } from './settings.repository';

// The settings module's public API for other modules (repos now, the review worker later).
// Other modules inject this service, never SettingsRepository, and secrets never leave the server.
@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  // The saved GitHub token in plain text, for calling GitHub.
  async getGithubToken(): Promise<string> {
    const settings = await this.settingsRepository.findSingleton();
    if (!settings?.githubTokenEnc) {
      throw new BadRequestException('Connect your GitHub token in Settings first.');
    }
    try {
      return this.crypto.decrypt(settings.githubTokenEnc);
    } catch {
      throw new BadRequestException(
        'The saved GitHub token cannot be decrypted (was ENCRYPTION_KEY changed?). Enter the token again.',
      );
    }
  }
}
