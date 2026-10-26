import type { Octokit } from 'octokit';
import { isNoise, isProfileConfigPath } from './profile-files.js';
import { CONTRIBUTING_FILES, README_FILES, RULE_FILES } from './repo-context.js';

// Has the repository changed enough since a profile was built that the profile should be built again?
// Changes to the files that state how the project works count at once; ordinary code changes only count when
// there are many of them, because a profile describes the shape of a project, not each commit.

export const STALE_FILE_THRESHOLD = 60;

const PROJECT_DOCS = new Set([...README_FILES, ...RULE_FILES, ...CONTRIBUTING_FILES]);
const DESIGN_DOC = /(^|\/)(architecture|design|conventions?|guidelines?|style[-_ ]?guide|principles)[^/]*\.md$/i;

// A file that tells what the project is or how it is written: documents, rules, configuration, workflows.
export function isProjectDefiningPath(path: string): boolean {
  return PROJECT_DOCS.has(path) || DESIGN_DOC.test(path) || isProfileConfigPath(path);
}

export type Freshness = { stale: boolean; reason: string | undefined };

export function judgeChanges(changedPaths: string[], threshold: number = STALE_FILE_THRESHOLD): Freshness {
  const defining = changedPaths.filter(isProjectDefiningPath);
  if (defining.length > 0) {
    const shown = defining.slice(0, 3).join(', ');
    return { stale: true, reason: `${shown}${defining.length > 3 ? ` and ${defining.length - 3} more` : ''} changed` };
  }
  const real = changedPaths.filter((path) => !isNoise(path)).length;
  if (real >= threshold) return { stale: true, reason: `${real} files changed` };
  return { stale: false, reason: undefined };
}

// Compares the branch head with the commit the profile was built from. When GitHub says it cannot compare them (the
// history was rewritten, the commit is gone) the profile is stale: it describes something that no longer exists.
// Any other failure (network, rate limit) is thrown: it says nothing about the repository.
export async function checkProfileFreshness(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  builtCommit: string,
  threshold?: number,
): Promise<Freshness & { head: string | undefined }> {
  try {
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${builtCommit}...${branch}` });
    if (data.status === 'identical') return { stale: false, reason: undefined, head: builtCommit };
    // GitHub lists at most 300 files, far above the threshold.
    const files = (data.files ?? []).map((file) => file.filename);
    return { ...judgeChanges(files, threshold), head: data.commits.at(-1)?.sha };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404 && status !== 422) throw err;
    return { stale: true, reason: 'the history of the branch changed', head: undefined };
  }
}
