import { Octokit } from 'octokit';

export type PullRequestInfo = {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  url: string;
  headSha: string;
  isDraft: boolean;
  authorLogin: string;
  authorIsBot: boolean;
};

export type ChangedFile = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  // GitHub omits the patch for binary files and very large diffs.
  patch: string | undefined;
};

export type AccessibleRepo = {
  fullName: string;
  owner: string;
  name: string;
  isPrivate: boolean;
};

export type RepositoryInfo = AccessibleRepo & { archived: boolean };

// Safety stop for accounts with a huge number of repositories.
export const MAX_ACCESSIBLE_REPOS = 1_000;

export function createGithubClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function getAuthenticatedLogin(token: string): Promise<string> {
  const { data } = await createGithubClient(token).rest.users.getAuthenticated();
  return data.login;
}

type RawPullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  draft?: boolean;
  head: { sha: string };
  // GitHub can return null here, e.g. when the author's account was deleted.
  user: { login: string; type: string } | null;
};

function toPullRequestInfo(owner: string, repo: string, data: RawPullRequest): PullRequestInfo {
  return {
    owner,
    repo,
    number: data.number,
    title: data.title,
    body: data.body ?? '',
    url: data.html_url,
    headSha: data.head.sha,
    isDraft: data.draft ?? false,
    authorLogin: data.user?.login ?? 'ghost',
    authorIsBot: data.user?.type === 'Bot',
  };
}

export async function getPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestInfo> {
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
  return toPullRequestInfo(owner, repo, data);
}

// Every open pull request of a repository (all pages), with the head commit it has right now.
export async function listOpenPullRequests(octokit: Octokit, owner: string, repo: string): Promise<PullRequestInfo[]> {
  const pulls = await octokit.paginate(octokit.rest.pulls.list, { owner, repo, state: 'open', per_page: 100 });
  return pulls.map((data) => toPullRequestInfo(owner, repo, data));
}

export async function listChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
): Promise<ChangedFile[]> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  });
  return files.map((f) => ({
    path: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

// The repository's .gitattributes at a commit, or undefined when it has none (or it cannot be read).
// Used only to learn which files are marked generated, so any failure just means "none are".
export async function getGitattributes(octokit: Octokit, owner: string, repo: string, ref: string): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path: '.gitattributes', ref });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) return undefined;
    return Buffer.from(data.content, 'base64').toString('utf8');
  } catch {
    return undefined;
  }
}

// Repositories the token can see. Archived and disabled ones are left out: GitHub does not
// allow reviews on them.
export async function listAccessibleRepos(octokit: Octokit): Promise<AccessibleRepo[]> {
  const repos: AccessibleRepo[] = [];
  const pages = octokit.paginate.iterator(octokit.rest.repos.listForAuthenticatedUser, {
    per_page: 100,
    sort: 'full_name',
  });

  for await (const { data } of pages) {
    for (const repo of data) {
      if (repo.archived || repo.disabled) continue;
      repos.push({ fullName: repo.full_name, owner: repo.owner.login, name: repo.name, isPrivate: repo.private });
    }
    if (repos.length >= MAX_ACCESSIBLE_REPOS) break;
  }
  return repos.slice(0, MAX_ACCESSIBLE_REPOS);
}

// One repository, with the owner/name casing GitHub uses. Throws a 404 error if it does not
// exist or the token cannot see it (GitHub answers 404 for both, on purpose).
export async function getRepository(octokit: Octokit, owner: string, name: string): Promise<RepositoryInfo> {
  const { data } = await octokit.rest.repos.get({ owner, repo: name });
  return {
    fullName: data.full_name,
    owner: data.owner.login,
    name: data.name,
    isPrivate: data.private,
    archived: data.archived,
  };
}
