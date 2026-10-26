import type { Finding } from '@diffy/shared';
import type { Octokit } from 'octokit';
import { buildPromptDiff, DEFAULT_MAX_DIFF_CHARS, type SkippedFile } from './annotate.js';
import { buildCommentableIndex } from './diff.js';
import { parseGeneratedAttributes } from './gitattributes.js';
import { getGitattributes, listChangedFiles, type PullRequestInfo } from './github.js';
import { generateReview, type LlmConfig, type LlmUsage } from './llm.js';
import { ignoreMatcher, loadRepoConfig } from './repo-config.js';
import { DEFAULT_MAX_CONTEXT_CHARS, loadRepoContext } from './repo-context.js';
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
  // How much of the project's README and rule files may go into the prompt. 0 = none.
  maxContextChars?: number;
};

export type ReviewOutcome = 'posted' | 'not-posted' | 'nothing-to-review';

export type ReviewResult = {
  outcome: ReviewOutcome;
  summary: string;
  findings: Finding[];
  skipped: SkippedFile[];
  // Problems in the repository's .diffy.yaml (empty when there is none or it is fine).
  configNotes: string[];
  // The project documents that were read for this review.
  contextFiles: string[];
  usage: LlmUsage | undefined;
  githubReviewUrl: string | undefined;
  fellBackToSummary: boolean;
};

// The whole pipeline: fetch files -> build the diff -> ask the LLM -> check lines -> post.
// No database and no framework: the server wraps this and stores what it returns.
export async function reviewPullRequest(input: ReviewPullRequestInput): Promise<ReviewResult> {
  const { octokit, pr, llm, post = true, maxDiffChars = DEFAULT_MAX_DIFF_CHARS, maxContextChars = DEFAULT_MAX_CONTEXT_CHARS } = input;

  const [files, gitattributes, { config, warnings: configNotes, branch }] = await Promise.all([
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
      contextFiles: [],
      usage: undefined,
      githubReviewUrl: undefined,
      fellBackToSummary: false,
    };
  }

  // The project's own documents, so the model knows what it is reviewing. Without a branch GitHub could not
  // be asked (and the config note says why), so there is nothing to read.
  const context = branch
    ? await loadRepoContext(octokit, pr.owner, pr.repo, branch, { contextFiles: config.contextFiles, maxChars: maxContextChars })
    : { docs: [], warnings: [] };
  configNotes.push(...context.warnings);
  const contextFiles = context.docs.map((doc) => doc.path);

  const { review, usage } = await generateReview(
    llm,
    buildSystemPrompt(config, { hasDocs: context.docs.length > 0 }),
    buildUserPrompt(pr, diff, config.pathInstructions, context.docs),
  );
  const findings = placeFindings(review.findings, buildCommentableIndex(files));
  const base = { summary: review.summary, skipped: diff.skipped, configNotes, contextFiles, usage };

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
    contextFiles,
  });
  return {
    ...base,
    outcome: 'posted',
    findings: posted.findings,
    githubReviewUrl: posted.url,
    fellBackToSummary: posted.fellBackToSummary,
  };
}
