import type { LlmFinding } from '@diffy/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/llm.js', () => ({ generateStructured: vi.fn() }));

import type { PromptDiff } from '../src/annotate.js';
import { generateStructured } from '../src/llm.js';
import { applyVerdicts, buildVerifyPrompt, MIN_CONFIDENCE, verifyFindings } from '../src/verify.js';

const llm = { provider: 'openai', model: 'm', apiKey: 'k' } as const;

const finding = (path: string, title: string, line = 5): LlmFinding => ({
  path,
  startLine: null,
  line,
  severity: 'high',
  title,
  explanation: 'It breaks.\nBadly.',
  fixPrompt: 'f',
  suggestion: null,
});

const diff: PromptDiff = {
  text: 'A\nB',
  included: ['a.ts', 'b.ts'],
  skipped: [],
  parts: [
    { path: 'a.ts', block: '### a.ts\n+ code A' },
    { path: 'b.ts', block: '### b.ts\n+ code B' },
  ],
};

const verdict = (index: number, real: boolean, confidence = 90) => ({ index, real, confidence, reason: 'r' });

beforeEach(() => {
  vi.mocked(generateStructured).mockReset();
});

describe('applyVerdicts', () => {
  const findings = [finding('a.ts', 'one'), finding('a.ts', 'two'), finding('a.ts', 'three')];

  it('drops findings judged not real, and findings the checker is unsure of', () => {
    const kept = applyVerdicts(findings, [verdict(0, false), verdict(1, true, MIN_CONFIDENCE - 1), verdict(2, true, MIN_CONFIDENCE)]);
    expect(kept.map((f) => f.title)).toEqual(['three']);
  });

  it('keeps a finding that has no verdict: silence is not a refutation', () => {
    expect(applyVerdicts(findings, [verdict(1, false)]).map((f) => f.title)).toEqual(['one', 'three']);
  });
});

describe('buildVerifyPrompt', () => {
  it('numbers the findings and shows only the code of the files they name', () => {
    const prompt = buildVerifyPrompt(diff, [finding('a.ts', 'Null deref', 12)], new Set(['a.ts']));
    expect(prompt).toContain('+ code A');
    expect(prompt).not.toContain('+ code B');
    expect(prompt).toContain('0. [high] a.ts:12 Null deref\n   It breaks. Badly.');
  });
});

describe('verifyFindings', () => {
  it('drops the refuted findings and reports the cost of the check', async () => {
    vi.mocked(generateStructured).mockResolvedValue({
      output: { verdicts: [verdict(0, true), verdict(1, false)] },
      usage: { inputTokens: 50, outputTokens: 5 },
    });
    const result = await verifyFindings(llm, diff, [finding('a.ts', 'real'), finding('b.ts', 'wrong')]);

    expect(result.findings.map((f) => f.title)).toEqual(['real']);
    expect(result).toMatchObject({ checked: 2, dropped: 1, usage: { inputTokens: 50, outputTokens: 5 } });
  });

  it('leaves a finding about a file that is not in the prompt alone, and does not number it for the model', async () => {
    vi.mocked(generateStructured).mockResolvedValue({ output: { verdicts: [verdict(0, false)] }, usage: { inputTokens: 1, outputTokens: 1 } });
    const result = await verifyFindings(llm, diff, [finding('elsewhere.ts', 'unseen'), finding('a.ts', 'wrong')]);

    expect(result.findings.map((f) => f.title)).toEqual(['unseen']);
    expect(vi.mocked(generateStructured).mock.calls[0]![3]).toContain('0. [high] a.ts:5 wrong');
  });

  it('makes no call when no finding can be checked', async () => {
    const findings = [finding('elsewhere.ts', 'unseen')];
    const result = await verifyFindings(llm, diff, findings);
    expect(result).toEqual({ findings, checked: 0, dropped: 0, usage: undefined });
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('keeps every finding when the check itself fails', async () => {
    vi.mocked(generateStructured).mockRejectedValue(new Error('LLM call failed'));
    const findings = [finding('a.ts', 'one'), finding('b.ts', 'two')];
    expect(await verifyFindings(llm, diff, findings)).toEqual({ findings, checked: 0, dropped: 0, usage: undefined });
  });
});
