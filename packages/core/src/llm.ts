import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LlmReview, type LlmProvider } from '@diffy/shared';
import { generateText, Output, type LanguageModel } from 'ai';

export type LlmConfig = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
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
  try {
    const result = await generateText({
      model: createModel(config),
      system,
      prompt,
      output: Output.object({ schema: LlmReview }),
    });
    return {
      review: result.output,
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`LLM call failed (${config.provider}/${config.model}): ${reason}`);
  }
}
