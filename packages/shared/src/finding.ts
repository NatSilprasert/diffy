import { z } from 'zod';

export const Severity = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof Severity>;

export const LlmProvider = z.enum(['openai', 'anthropic', 'google', 'openrouter']);
export type LlmProvider = z.infer<typeof LlmProvider>;

// Filled by the LLM. Use nullable, not optional: OpenAI strict mode needs every key present.
export const LlmFinding = z.object({
  path: z.string().describe('File path exactly as in the diff header'),
  startLine: z
    .number()
    .int()
    .nullable()
    .describe('First line of a multi-line range (new-file numbering), else null'),
  line: z
    .number()
    .int()
    .describe('Line (new-file numbering) the comment attaches to; last line of the range'),
  severity: Severity,
  title: z.string().describe('One-line summary, max ~80 chars'),
  explanation: z.string().describe('What is wrong and why it matters, 1-4 sentences'),
  fixPrompt: z.string().describe('Self-contained instruction a coding agent can execute'),
  suggestion: z
    .string()
    .nullable()
    .describe('Exact replacement for lines startLine..line, or null if no exact fix'),
});
export type LlmFinding = z.infer<typeof LlmFinding>;

// How careful a human reviewer should be with a group of changes.
export const WalkthroughRisk = z.enum(['low', 'medium', 'high']);
export type WalkthroughRisk = z.infer<typeof WalkthroughRisk>;

// One group of related files in the walkthrough of a pull request.
export const LlmWalkthroughGroup = z.object({
  title: z.string().describe('Short name of this group of changes, for example "Student registration flow"'),
  description: z.string().describe('What changed in this group, 1-2 sentences'),
  files: z.array(z.string()).describe('Paths from the diff that belong to this group, exactly as in the diff header'),
  risk: WalkthroughRisk.describe('How careful a human reviewer should be with this group'),
});
export type LlmWalkthroughGroup = z.infer<typeof LlmWalkthroughGroup>;

export const LlmReview = z.object({
  summary: z.string().describe('2-5 sentence overview of the PR and its risk'),
  walkthrough: z
    .array(LlmWalkthroughGroup)
    .describe('The pull request as 2 to 8 groups of related files, riskiest first. Empty when it changes 3 files or fewer'),
  findings: z.array(LlmFinding),
});
export type LlmReview = z.infer<typeof LlmReview>;

// After diff validation: where the finding ended up on GitHub.
export const Placement = z.enum(['inline', 'summary']);
export type Placement = z.infer<typeof Placement>;

export const Finding = LlmFinding.extend({ placement: Placement });
export type Finding = z.infer<typeof Finding>;
