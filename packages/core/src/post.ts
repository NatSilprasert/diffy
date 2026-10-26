import type { Finding } from '@diffy/shared';
import type { Octokit } from 'octokit';
import type { SkippedFile } from './annotate.js';
import type { PullRequestInfo } from './github.js';
import { renderInlineComment, renderSummary } from './render.js';
import type { WalkthroughGroup } from './walkthrough.js';

export type PostReviewInput = {
  pr: PullRequestInfo;
  summary: string;
  findings: Finding[];
  skipped: SkippedFile[];
  model: string;
  configNotes?: string[];
  contextFiles?: string[];
  usedProfile?: boolean;
  walkthrough?: WalkthroughGroup[];
};

export type PostedReview = {
  url: string;
  // True when GitHub rejected the inline comments and every finding went into the summary.
  fellBackToSummary: boolean;
  // The findings as they were actually posted (placement may differ from the input after a fallback).
  findings: Finding[];
};

type ReviewComment = {
  path: string;
  line: number;
  side: 'RIGHT';
  start_line?: number;
  start_side?: 'RIGHT';
  body: string;
};

function toReviewComment(f: Finding): ReviewComment {
  const comment: ReviewComment = { path: f.path, line: f.line, side: 'RIGHT', body: renderInlineComment(f) };
  if (f.startLine !== null) {
    comment.start_line = f.startLine;
    comment.start_side = 'RIGHT';
  }
  return comment;
}

function isValidationError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 422;
}

async function createReview(octokit: Octokit, input: PostReviewInput, findings: Finding[]): Promise<string> {
  const comments = findings.filter((f) => f.placement === 'inline').map(toReviewComment);
  const { data } = await octokit.rest.pulls.createReview({
    owner: input.pr.owner,
    repo: input.pr.repo,
    pull_number: input.pr.number,
    // Pin the review to the reviewed commit even if a new push lands while the LLM is running.
    commit_id: input.pr.headSha,
    // COMMENT only: GitHub refuses REQUEST_CHANGES/APPROVE on your own PR.
    event: 'COMMENT',
    body: renderSummary({
      summary: input.summary,
      findings,
      skipped: input.skipped,
      model: input.model,
      headSha: input.pr.headSha,
      configNotes: input.configNotes,
      contextFiles: input.contextFiles,
      usedProfile: input.usedProfile,
      walkthrough: input.walkthrough,
    }),
    comments: comments.length > 0 ? comments : undefined,
  });
  return data.html_url;
}

export async function postReview(octokit: Octokit, input: PostReviewInput): Promise<PostedReview> {
  try {
    const url = await createReview(octokit, input, input.findings);
    return { url, fellBackToSummary: false, findings: input.findings };
  } catch (err) {
    const hasInline = input.findings.some((f) => f.placement === 'inline');
    if (!isValidationError(err) || !hasInline) throw err;

    // One bad inline comment makes GitHub reject the whole review. Retry once with
    // everything in the summary so the review is never lost.
    const allInSummary = input.findings.map((f): Finding => ({ ...f, placement: 'summary' }));
    const url = await createReview(octokit, input, allInSummary);
    return { url, fellBackToSummary: true, findings: allInSummary };
  }
}
