import { App, type Octokit } from 'octokit';
import { MAX_ACCESSIBLE_REPOS, type AccessibleRepo } from './github.js';

// diffy as a GitHub App: reviews are posted by "diffy[bot]", not by whoever owns a token. The App has one private
// key (kept on diffy's server); each person installs the App on their account and picks the repositories. For a
// repository the App acts through the installation that holds it, with a token GitHub makes for that installation.

export type GithubAppCredentials = { appId: number; privateKey: string };

export function createGithubApp({ appId, privateKey }: GithubAppCredentials): App {
  return new App({ appId, privateKey });
}

// Proof that the id and the key belong together, and who the App is.
export async function getAppIdentity(app: App): Promise<{ slug: string; name: string }> {
  const { data } = await app.octokit.rest.apps.getAuthenticated();
  if (!data) throw new Error('GitHub did not say which App this is.');
  return { slug: data.slug ?? '', name: data.name };
}

export type AppInstallation = {
  id: number;
  // The user or organization the App is installed on.
  account: string;
  // 'all' or 'selected' repositories.
  repositorySelection: string;
};

export async function listAppInstallations(app: App): Promise<AppInstallation[]> {
  const installations = await app.octokit.paginate(app.octokit.rest.apps.listInstallations, { per_page: 100 });
  return installations.map((installation) => ({
    id: installation.id,
    // A user or organization has a login; an enterprise has a slug.
    account: ((a) => a?.login ?? a?.slug ?? '')(installation.account as { login?: string; slug?: string } | null),
    repositorySelection: installation.repository_selection,
  }));
}

// A client that acts as one installation of the App. Its token is made and renewed by the App as needed.
export function getInstallationClient(app: App, installationId: number): Promise<Octokit> {
  return app.getInstallationOctokit(installationId);
}

// A client that acts as the App on one repository. Throws a plain message when the App is not installed there.
export async function getRepoInstallationClient(app: App, owner: string, repo: string): Promise<Octokit> {
  try {
    const { data } = await app.octokit.rest.apps.getRepoInstallation({ owner, repo });
    return await app.getInstallationOctokit(data.id);
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw new Error(`diffy is not installed on ${owner}/${repo}, or was not given access to it.`);
    }
    throw err;
  }
}

// The repositories one installation was given. Archived and disabled ones are left out, as for a token.
export async function listInstallationRepos(client: Octokit): Promise<AccessibleRepo[]> {
  const repos: AccessibleRepo[] = [];
  const pages = client.paginate.iterator(client.rest.apps.listReposAccessibleToInstallation, { per_page: 100 });
  for await (const { data } of pages) {
    for (const repo of data) {
      if (repo.archived || repo.disabled) continue;
      repos.push({ fullName: repo.full_name, owner: repo.owner.login, name: repo.name, isPrivate: repo.private });
    }
    if (repos.length >= MAX_ACCESSIBLE_REPOS) break;
  }
  return repos.slice(0, MAX_ACCESSIBLE_REPOS);
}
