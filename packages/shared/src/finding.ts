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

export const LlmReview = z.object({
  summary: z.string().describe('2-5 sentence overview of the PR and its risk'),
  findings: z.array(LlmFinding),
});
export type LlmReview = z.infer<typeof LlmReview>;

// After diff validation: where the finding ended up on GitHub.
export const Placement = z.enum(['inline', 'summary']);
export type Placement = z.infer<typeof Placement>;

export const Finding = LlmFinding.extend({ placement: Placement });
export type Finding = z.infer<typeof Finding>;
