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

export function createGithubClient(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function getAuthenticatedLogin(token: string): Promise<string> {
  const { data } = await createGithubClient(token).rest.users.getAuthenticated();
  return data.login;
}

export async function getPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestInfo> {
  const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
  return {
    owner,
    repo,
    number,
    title: data.title,
    body: data.body ?? '',
    url: data.html_url,
    headSha: data.head.sha,
    isDraft: data.draft ?? false,
    authorLogin: data.user.login,
    authorIsBot: data.user.type === 'Bot',
  };
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
