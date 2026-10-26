import type { Octokit } from 'octokit';
import type { PullRequestInfo } from './github.js';

// The issues a pull request says it closes ("Closes #12"). What the issue asks for is the best statement of what the
// change should do, so the reviewer can tell when the code does something else.

export type LinkedIssue = { number: number; title: string; body: string; truncated: boolean };

export const MAX_LINKED_ISSUES = 3;
export const MAX_ISSUE_BODY_CHARS = 2_000;

// GitHub's own closing keywords. "#12", "owner/repo#12" and the URL of the issue all name an issue.
const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+(?:https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/|([\w.-]+)\/([\w.-]+)#|#)(\d+)/gi;

// Issue numbers of this repository, in the order the text names them, without repeats and without the pull request itself.
export function parseLinkedIssues(body: string, pr: Pick<PullRequestInfo, 'owner' | 'repo' | 'number'>): number[] {
  const same = (owner: string | undefined, repo: string | undefined) =>
    owner === undefined || (owner.toLowerCase() === pr.owner.toLowerCase() && repo?.toLowerCase() === pr.repo.toLowerCase());

  const numbers: number[] = [];
  for (const match of body.matchAll(CLOSING)) {
    const [, urlOwner, urlRepo, refOwner, refRepo, digits] = match;
    if (!same(urlOwner ?? refOwner, urlRepo ?? refRepo)) continue;
    const number = Number(digits);
    if (number !== pr.number && !numbers.includes(number)) numbers.push(number);
  }
  return numbers.slice(0, MAX_LINKED_ISSUES);
}

// Reads them from GitHub. An issue that cannot be read (deleted, no access, or really a pull request) is left out:
// the review is better without it than not done.
export async function loadLinkedIssues(octokit: Octokit, pr: PullRequestInfo): Promise<LinkedIssue[]> {
  const loaded = await Promise.all(
    parseLinkedIssues(pr.body, pr).map(async (number): Promise<LinkedIssue | undefined> => {
      try {
        const { data } = await octokit.rest.issues.get({ owner: pr.owner, repo: pr.repo, issue_number: number });
        if (data.pull_request) return undefined;
        const body = data.body ?? '';
        return {
          number,
          title: data.title,
          body: body.slice(0, MAX_ISSUE_BODY_CHARS),
          truncated: body.length > MAX_ISSUE_BODY_CHARS,
        };
      } catch {
        return undefined;
      }
    }),
  );
  return loaded.filter((issue): issue is LinkedIssue => issue !== undefined);
}
