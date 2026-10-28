import {
  createGithubApp,
  createGithubClient,
  getInstallationClient,
  getRepoInstallationClient,
  listAccessibleRepos,
  listAppInstallations,
  listInstallationRepos,
  type AccessibleRepo,
} from '@diffy/core';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ENV } from '../../infra/config/config.module';
import type { Env } from '../../infra/config/env';
import { readAppPrivateKey } from '../../infra/github/app-private-key';
import { SettingsService } from '../settings/settings.service';

type Octokit = ReturnType<typeof createGithubClient>;

export type GithubAccess = {
  octokit: Octokit;
  // Secrets that must never appear in a stored error message (the personal token, when that is what is used).
  secrets: string[];
};

type App = ReturnType<typeof createGithubApp>;

// How diffy talks to GitHub. With the GitHub App set up in .env, every repository is reached through the
// installation the App has on it, so reviews come from "<app>[bot]". Without it the saved personal token is used
// (the old mode, until it is removed).
@Injectable()
export class GithubService {
  private app: App | undefined;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly settingsService: SettingsService,
  ) {}

  isAppMode(): boolean {
    return Boolean(this.env.GITHUB_APP_ID && this.env.GITHUB_APP_PRIVATE_KEY_PATH);
  }

  // A client that acts on one repository.
  async getAccess(owner: string, repo: string): Promise<GithubAccess> {
    if (this.isAppMode()) return { octokit: await getRepoInstallationClient(this.getApp(), owner, repo), secrets: [] };
    const token = await this.settingsService.getGithubToken();
    return { octokit: createGithubClient(token), secrets: [token] };
  }

  // The repositories diffy can be pointed at: the ones the App was given, or the ones the token can see.
  async listRepos(): Promise<AccessibleRepo[]> {
    if (!this.isAppMode()) return listAccessibleRepos(createGithubClient(await this.settingsService.getGithubToken()));

    const app = this.getApp();
    const repos: AccessibleRepo[] = [];
    for (const installation of await listAppInstallations(app)) {
      repos.push(...(await listInstallationRepos(await getInstallationClient(app, installation.id))));
    }
    return repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  // Made once: the App keeps the tokens of its installations and renews them by itself.
  private getApp(): App {
    if (!this.app) {
      try {
        this.app = createGithubApp({ appId: this.env.GITHUB_APP_ID!, privateKey: readAppPrivateKey(this.env.GITHUB_APP_PRIVATE_KEY_PATH!) });
      } catch (err) {
        throw new ServiceUnavailableException(err instanceof Error ? err.message : 'The GitHub App is not set up.');
      }
    }
    return this.app;
  }
}
