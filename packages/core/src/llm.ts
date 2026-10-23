import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LlmReview, type LlmProvider } from '@diffy/shared';
import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';

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

// One place for the timeout and the error wrapping, whatever the schema.
async function generateStructured<T>(
  config: LlmConfig,
  schema: z.ZodType<T>,
  system: string | undefined,
  prompt: string,
): Promise<{ output: T; usage: LlmUsage }> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  const abortSignal = AbortSignal.timeout(timeoutMs);
  try {
    const result = await generateText({
      model: createModel(config),
      ...(system ? { system } : {}),
      prompt,
      output: Output.object({ schema }),
      abortSignal,
    });
    return {
      output: result.output,
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

export async function generateReview(
  config: LlmConfig,
  system: string,
  prompt: string,
): Promise<{ review: LlmReview; usage: LlmUsage }> {
  const { output, usage } = await generateStructured(config, LlmReview, system, prompt);
  return { review: output, usage };
}

// A tiny structured-output call. Passing proves the key works AND the model can fill a schema,
// which a plain "hello" request would not (some OpenRouter models cannot).
const PingSchema = z.object({ ok: z.boolean() });

export async function pingLlm(config: LlmConfig): Promise<void> {
  await generateStructured(config, PingSchema, undefined, 'Reply with ok set to true.');
}
