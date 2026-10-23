import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LlmReview, type LlmProvider } from '@diffy/shared';
import { generateText, Output, type LanguageModel } from 'ai';

// Slow "thinking" models can take minutes on a big diff; this only guards against a call that never returns.
export const DEFAULT_LLM_TIMEOUT_MS = 600_000;

export type LlmConfig = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  // A stuck provider must not block the review queue forever.
  timeoutMs?: number;
};

export type LlmUsage = {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
};

export function createModel({ provider, model, apiKey }: LlmConfig): LanguageModel {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })(model);
    case 'anthropic':
      return createAnthropic({ apiKey })(model);
    case 'google':
      return createGoogle({ apiKey })(model);
    case 'openrouter':
      return createOpenRouter({ apiKey }).chat(model);
  }
}

export async function generateReview(
  config: LlmConfig,
  system: string,
  prompt: string,
): Promise<{ review: LlmReview; usage: LlmUsage }> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  try {
    const result = await generateText({
      model: createModel(config),
      system,
      prompt,
      output: Output.object({ schema: LlmReview }),
      abortSignal,
    });
    return {
      review: result.output,
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
    };
  } catch (err) {
    const reason = abortSignal.aborted
      ? `timed out after ${Math.round(timeoutMs / 1000)}s (try a faster model)`
      : err instanceof Error
        ? err.message
        : String(err);
    throw new Error(`LLM call failed (${config.provider}/${config.model}): ${reason}`);
  }
}
