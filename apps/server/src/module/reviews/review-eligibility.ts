// Which pull requests get a review. One rule for every way diffy learns about a pull request (the webhook).
export type ReviewablePullRequest = { isDraft: boolean; authorIsBot: boolean; headSha: string };

// Drafts are not ready for review yet; they get one when marked ready (same commit, no review row yet).
// Bots (Dependabot and the like) open many pull requests nobody wants an AI opinion on.
// A commit that was already open when the repository was added is not reviewed; a newer commit is.
export function isReviewable(pr: ReviewablePullRequest, baselineShas: string[]): boolean {
  if (pr.isDraft || pr.authorIsBot) return false;
  return !baselineShas.includes(pr.headSha);
}
