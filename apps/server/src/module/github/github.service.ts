import {
  createGithubApp,
  getAppIdentity,
  getInstallationClient,
  getRepoInstallationClient,
  listAppInstallations,
  listInstallationRepos,
  type AccessibleRepo,
} from '@diffy/core';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ENV } from '../../infra/config/config.module';
import type { Env } from '../../infra/config/env';
import { readAppPrivateKey } from '../../infra/github/app-private-key';
import { GithubRepository, type InstallationData } from './github.repository';

type App = ReturnType<typeof createGithubApp>;
type Octokit = Awaited<ReturnType<typeof getRepoInstallationClient>>;

export type GithubAccess = {
  octokit: Octokit;
  // Secrets that must never appear in a stored error message. The App's tokens are made by GitHub for one hour and
  // never typed by anyone, so there are none to hide.
  secrets: string[];
};

export type AppInfo = { name: string; slug: string; installUrl: string };

export type InstalledAccount = { login: string; type: string; repositorySelection: string };

// How diffy talks to GitHub: always as its GitHub App. Every repository is reached through the installation the App
// has on it, so reviews come from "<app>[bot]" and diffy only sees the repositories people gave it.
@Injectable()
export class GithubService {
  private app: App | undefined;
  private info: AppInfo | undefined;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly githubRepository: GithubRepository,
  ) {}

  // A client that acts on one repository.
  async getAccess(owner: string, repo: string): Promise<GithubAccess> {
    return { octokit: await getRepoInstallationClient(this.getApp(), owner, repo), secrets: [] };
  }

  // The repositories diffy can be pointed at: the ones the App was given, across all its installations.
  async listRepos(): Promise<AccessibleRepo[]> {
    const app = this.getApp();
    const repos: AccessibleRepo[] = [];
    for (const installation of await listAppInstallations(app)) {
      repos.push(...(await listInstallationRepos(await getInstallationClient(app, installation.id))));
    }
    return repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  // Who the App is, and where a person installs it. Asked from GitHub once, then remembered.
  async getAppInfo(): Promise<AppInfo> {
    if (!this.info) {
      const { name, slug } = await getAppIdentity(this.getApp());
      this.info = { name, slug, installUrl: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new` };
    }
    return this.info;
  }

  // The accounts the App is installed on now, as the webhooks reported them.
  async listInstalledAccounts(): Promise<InstalledAccount[]> {
    const installations = await this.githubRepository.findActiveInstallations();
    return installations.map((installation) => ({
      login: installation.accountLogin,
      type: installation.accountType,
      repositorySelection: installation.repositorySelection,
    }));
  }

  // Where the App is installed is kept up to date from GitHub's webhooks.
  recordInstallation(data: InstallationData): Promise<void> {
    return this.githubRepository.upsertInstallation(data);
  }

  markInstallation(installationId: number, change: { removedAt?: Date | null; suspendedAt?: Date | null }): Promise<boolean> {
    return this.githubRepository.updateInstallation(installationId, change);
  }

  // Made once: the App keeps the tokens of its installations and renews them by itself.
  private getApp(): App {
    if (!this.app) {
      try {
        this.app = createGithubApp({ appId: this.env.GITHUB_APP_ID, privateKey: readAppPrivateKey(this.env.GITHUB_APP_PRIVATE_KEY_PATH) });
      } catch (err) {
        throw new ServiceUnavailableException(err instanceof Error ? err.message : 'The GitHub App is not set up.');
      }
    }
    return this.app;
  }
}
