import type { Octokit } from 'octokit';
import type { PullRequestInfo } from './github.js';

// The checks (CI, linters, type checks) that have already failed on the commit under review. A failing check often
// names the exact line the reviewer should look at. A check that is still running says nothing yet, and diffy does
// not wait for it.

export type FailedCheck = {
  name: string;
  // What the check reported: its title and summary, cut short.
  summary: string;
  // Where it pointed in the code, e.g. "src/a.ts:12: Unexpected any".
  annotations: string[];
};

export const MAX_FAILED_CHECKS = 3;
export const MAX_ANNOTATIONS_PER_CHECK = 10;
export const MAX_CHECK_SUMMARY_CHARS = 600;
export const MAX_ANNOTATION_CHARS = 300;

const FAILED = new Set(['failure', 'timed_out']);

const oneLine = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
};

// Reading the checks is a bonus: a token without the permission, a GitHub error or a repository without CI all give
// an empty list, never a failed review.
export async function loadFailedChecks(octokit: Octokit, pr: PullRequestInfo): Promise<FailedCheck[]> {
  try {
    const { data } = await octokit.rest.checks.listForRef({ owner: pr.owner, repo: pr.repo, ref: pr.headSha, per_page: 100 });
    const failed = data.check_runs.filter((run) => run.conclusion !== null && FAILED.has(run.conclusion)).slice(0, MAX_FAILED_CHECKS);

    return await Promise.all(
      failed.map(async (run) => {
        const annotations = await octokit.rest.checks
          .listAnnotations({ owner: pr.owner, repo: pr.repo, check_run_id: run.id, per_page: MAX_ANNOTATIONS_PER_CHECK })
          .then(({ data: list }) =>
            list.map((a) => `${a.path}:${a.start_line}: ${oneLine(a.message ?? a.title ?? '', MAX_ANNOTATION_CHARS)}`),
          )
          .catch(() => []);
        const summary = [run.output?.title, run.output?.summary].filter(Boolean).join(' - ');
        return { name: run.name, summary: oneLine(summary, MAX_CHECK_SUMMARY_CHARS), annotations };
      }),
    );
  } catch {
    return [];
  }
}
