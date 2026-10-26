import type { Finding } from '@diffy/shared';
import type { Octokit } from 'octokit';
import { buildPromptDiff, DEFAULT_MAX_DIFF_CHARS, type SkippedFile } from './annotate.js';
import { expandDiffContext } from './context-expand.js';
import { buildCommentableIndex } from './diff.js';
import { parseGeneratedAttributes } from './gitattributes.js';
import { getFileText, getGitattributes, listChangedFiles, type PullRequestInfo } from './github.js';
import { generateReview, type LlmConfig, type LlmUsage } from './llm.js';
import { ignoreMatcher, loadRepoConfig } from './repo-config.js';
import { DEFAULT_MAX_CONTEXT_CHARS, loadRepoContext } from './repo-context.js';
import { placeFindings } from './placement.js';
import { postReview } from './post.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import { verifyWalkthrough, type WalkthroughGroup } from './walkthrough.js';

export type ReviewPullRequestInput = {
  octokit: Octokit;
  pr: PullRequestInfo;
  llm: LlmConfig;
  // false = run the LLM and placement but do not post anything to GitHub.
  post?: boolean;
  maxDiffChars?: number;
  // How much of the project's README and rule files may go into the prompt. 0 = none.
  maxContextChars?: number;
  // Show the model the function around each change, and small files whole, instead of three lines (default true).
  expandContext?: boolean;
  // What diffy learned about the repository (markdown), and the notes the maintainers wrote in the web app.
  projectProfile?: string;
  maintainerNotes?: string;
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
  // The pull request in groups of related files, riskiest first (empty for a small change).
  walkthrough: WalkthroughGroup[];
  usage: LlmUsage | undefined;
  githubReviewUrl: string | undefined;
  fellBackToSummary: boolean;
};

// The whole pipeline: fetch files -> build the diff -> ask the LLM -> check lines -> post.
// No database and no framework: the server wraps this and stores what it returns.
export async function reviewPullRequest(input: ReviewPullRequestInput): Promise<ReviewResult> {
  const { octokit, pr, llm, post = true, maxDiffChars = DEFAULT_MAX_DIFF_CHARS, maxContextChars = DEFAULT_MAX_CONTEXT_CHARS, projectProfile, maintainerNotes, expandContext = true } = input;

  const [files, gitattributes, { config, warnings: configNotes, branch }] = await Promise.all([
    listChangedFiles(octokit, pr.owner, pr.repo, pr.number),
    getGitattributes(octokit, pr.owner, pr.repo, pr.headSha),
    loadRepoConfig(octokit, pr.owner, pr.repo),
  ]);
  const plainDiff = buildPromptDiff(files, maxDiffChars, {
    isGenerated: parseGeneratedAttributes(gitattributes),
    isIgnored: ignoreMatcher(config.ignore),
  });

  // Lockfile-only or binary-only PRs: nothing to say, and a noise review helps nobody.
  if (plainDiff.included.length === 0) {
    return {
      outcome: 'nothing-to-review',
      summary: 'No reviewable files in this pull request.',
      findings: [],
      skipped: plainDiff.skipped,
      configNotes,
      contextFiles: [],
      walkthrough: [],
      usage: undefined,
      githubReviewUrl: undefined,
      fellBackToSummary: false,
    };
  }

  // More than three lines around each change, within the same budget: the function it is in, or a small file whole.
  const diff = expandContext
    ? await expandDiffContext(plainDiff, files, (path) => getFileText(octokit, pr.owner, pr.repo, path, pr.headSha).then((text) => text || undefined), {
        maxChars: maxDiffChars,
      })
    : plainDiff;

  // The project's own documents, so the model knows what it is reviewing. Without a branch GitHub could not
  // be asked (and the config note says why), so there is nothing to read.
  const context = branch
    ? await loadRepoContext(octokit, pr.owner, pr.repo, branch, { contextFiles: config.contextFiles, maxChars: maxContextChars })
    : { docs: [], warnings: [] };
  configNotes.push(...context.warnings);
  const contextFiles = context.docs.map((doc) => doc.path);

  // The notes written in the web app count like the instructions of .diffy.yaml: both are the maintainers' own.
  const instructions = [config.instructions, maintainerNotes?.trim()].filter(Boolean).join('\n\n') || undefined;
  const { review, usage } = await generateReview(
    llm,
    buildSystemPrompt({ ...config, instructions }, { hasDocs: context.docs.length > 0, hasProfile: Boolean(projectProfile) }),
    buildUserPrompt(pr, diff, config.pathInstructions, context.docs, projectProfile),
  );
  const findings = placeFindings(review.findings, buildCommentableIndex(files));
  const walkthrough = verifyWalkthrough(review.walkthrough ?? [], diff.included);
  const base = { summary: review.summary, skipped: diff.skipped, configNotes, contextFiles, walkthrough, usage };

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
    usedProfile: Boolean(projectProfile),
    walkthrough,
  });
  return {
    ...base,
    outcome: 'posted',
    findings: posted.findings,
    githubReviewUrl: posted.url,
    fellBackToSummary: posted.fellBackToSummary,
  };
}
