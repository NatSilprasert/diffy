import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));

import { generateText } from 'ai';
import { DEFAULT_LLM_TIMEOUT_MS, generateReview } from '../src/llm.js';

const config = { provider: 'openai', model: 'm', apiKey: 'k' } as const;

beforeEach(() => {
  vi.mocked(generateText).mockReset();
});

describe('generateReview', () => {
  it('defaults the timeout to 10 minutes', () => {
    expect(DEFAULT_LLM_TIMEOUT_MS).toBe(600_000);
  });

  it('gives up with a clear message when the provider hangs', async () => {
    // Never answers; only settles when the abort signal fires, like a real stuck request.
    vi.mocked(generateText).mockImplementation(
      (opts: any) =>
        new Promise((_, reject) => {
          opts.abortSignal.addEventListener('abort', () => reject(opts.abortSignal.reason));
        }),
    );

    await expect(generateReview({ ...config, timeoutMs: 30 }, 's', 'p')).rejects.toThrow(
      /LLM call failed \(openai\/m\): timed out after 0s/,
    );
  });

  it('wraps provider errors with the provider and model', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('credit balance too low'));
    await expect(generateReview(config, 's', 'p')).rejects.toThrow(
      'LLM call failed (openai/m): credit balance too low',
    );
  });

  it('returns the validated review and usage', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { summary: 'ok', findings: [] },
      usage: { inputTokens: 5, outputTokens: 2 },
    } as any);
    await expect(generateReview(config, 's', 'p')).resolves.toEqual({
      review: { summary: 'ok', findings: [] },
      usage: { inputTokens: 5, outputTokens: 2 },
    });
  });
});
