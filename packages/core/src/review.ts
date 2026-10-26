import type { Finding } from '@diffy/shared';
import type { Octokit } from 'octokit';
import { buildPromptDiff, DEFAULT_MAX_DIFF_CHARS, type SkippedFile } from './annotate.js';
import { buildCommentableIndex } from './diff.js';
import { parseGeneratedAttributes } from './gitattributes.js';
import { getGitattributes, listChangedFiles, type PullRequestInfo } from './github.js';
import { generateReview, type LlmConfig, type LlmUsage } from './llm.js';
import { ignoreMatcher, loadRepoConfig } from './repo-config.js';
import { placeFindings } from './placement.js';
import { postReview } from './post.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';

export type ReviewPullRequestInput = {
  octokit: Octokit;
  pr: PullRequestInfo;
  llm: LlmConfig;
  // false = run the LLM and placement but do not post anything to GitHub.
  post?: boolean;
  maxDiffChars?: number;
};

export type ReviewOutcome = 'posted' | 'not-posted' | 'nothing-to-review';

export type ReviewResult = {
  outcome: ReviewOutcome;
  summary: string;
  findings: Finding[];
  skipped: SkippedFile[];
  // Problems in the repository's .diffy.yaml (empty when there is none or it is fine).
  configNotes: string[];
  usage: LlmUsage | undefined;
  githubReviewUrl: string | undefined;
  fellBackToSummary: boolean;
};

// The whole pipeline: fetch files -> build the diff -> ask the LLM -> check lines -> post.
// No database and no framework: the server wraps this and stores what it returns.
export async function reviewPullRequest(input: ReviewPullRequestInput): Promise<ReviewResult> {
  const { octokit, pr, llm, post = true, maxDiffChars = DEFAULT_MAX_DIFF_CHARS } = input;

  const [files, gitattributes, { config, warnings: configNotes }] = await Promise.all([
    listChangedFiles(octokit, pr.owner, pr.repo, pr.number),
    getGitattributes(octokit, pr.owner, pr.repo, pr.headSha),
    loadRepoConfig(octokit, pr.owner, pr.repo),
  ]);
  const diff = buildPromptDiff(files, maxDiffChars, {
    isGenerated: parseGeneratedAttributes(gitattributes),
    isIgnored: ignoreMatcher(config.ignore),
  });

  // Lockfile-only or binary-only PRs: nothing to say, and a noise review helps nobody.
  if (diff.included.length === 0) {
    return {
      outcome: 'nothing-to-review',
      summary: 'No reviewable files in this pull request.',
      findings: [],
      skipped: diff.skipped,
      configNotes,
      usage: undefined,
      githubReviewUrl: undefined,
      fellBackToSummary: false,
    };
  }

  const { review, usage } = await generateReview(llm, buildSystemPrompt(config), buildUserPrompt(pr, diff, config.pathInstructions));
  const findings = placeFindings(review.findings, buildCommentableIndex(files));
  const base = { summary: review.summary, skipped: diff.skipped, configNotes, usage };

  if (!post) {
    return { ...base, outcome: 'not-posted', findings, githubReviewUrl: undefined, fellBackToSummary: false };
  }

  const posted = await postReview(octokit, {
    pr,
    summary: review.summary,
    findings,
    skipped: diff.skipped,
    model: `${llm.provider}/${llm.model}`,
    configNotes,
  });
  return {
    ...base,
    outcome: 'posted',
    findings: posted.findings,
    githubReviewUrl: posted.url,
    fellBackToSummary: posted.fellBackToSummary,
  };
}
