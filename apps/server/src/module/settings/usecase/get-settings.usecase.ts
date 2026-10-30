import { Injectable } from '@nestjs/common';
import { GithubService } from '../../github/github.service';
import type { GetSettingsResponseDto } from '../dto/get-settings.dto';
import { SettingsRepository } from '../settings.repository';

@Injectable()
export class GetSettingsUsecase {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly githubService: GithubService,
  ) {}

  // `accountId` is null for a person who cannot use diffy for any account yet: they still see how to install it.
  async execute(accountId: string | null): Promise<GetSettingsResponseDto> {
    const settings = accountId ? await this.settingsRepository.findByAccountId(accountId) : null;
    const accounts = await this.githubService.listInstalledAccounts();
    // The name comes from GitHub. When GitHub cannot be reached the page still loads, only without the name.
    const app = await this.githubService.getAppInfo().catch(() => undefined);

    // Fields are copied one by one on purpose, so an encrypted column can never leak by accident.
    return {
      github: {
        configured: accounts.length > 0,
        appName: app?.name ?? null,
        installUrl: app?.installUrl ?? null,
        accounts: accounts.map((account) => ({
          login: account.login,
          type: account.type,
          repositorySelection: account.repositorySelection === 'all' ? 'all' : 'selected',
        })),
      },
      llm: {
        configured: settings?.llmProvider != null && settings.llmModel != null && settings.llmApiKeyEnc != null,
        provider: settings?.llmProvider ?? null,
        model: settings?.llmModel ?? null,
      },
    };
  }
}
