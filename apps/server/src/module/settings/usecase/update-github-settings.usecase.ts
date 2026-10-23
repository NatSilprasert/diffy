import { getAuthenticatedLogin } from '@diffy/core';
import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '../../../infra/crypto/crypto.service';
import type {
  UpdateGithubSettingsRequestDto,
  UpdateGithubSettingsResponseDto,
} from '../dto/update-github-settings.dto';
import { SettingsRepository } from '../settings.repository';

@Injectable()
export class UpdateGithubSettingsUsecase {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly crypto: CryptoService,
  ) {}

  async execute(input: UpdateGithubSettingsRequestDto): Promise<UpdateGithubSettingsResponseDto> {
    const login = await this.verifyToken(input.token);

    // Only the encrypted token is stored; the plain text goes no further than this method.
    await this.settingsRepository.upsertGithub({
      githubTokenEnc: this.crypto.encrypt(input.token),
      githubLogin: login,
    });
    return { login };
  }

  // Check the token against GitHub before saving it, so a typo is caught here and not on the first review.
  private async verifyToken(token: string): Promise<string> {
    try {
      return await getAuthenticatedLogin(token);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 || status === 403) {
        throw new BadRequestException('GitHub rejected this token. Check that it is correct and has not expired.');
      }
      throw new BadGatewayException('Could not reach GitHub to verify the token. Try again in a moment.');
    }
  }
}
