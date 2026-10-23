import { describe, expect, it } from 'vitest';
import { Finding, LlmReview } from '../src/index.js';

const validFinding = {
  path: 'src/auth/session.ts',
  startLine: null,
  line: 42,
  severity: 'high',
  title: 'Token is used without validation',
  explanation: 'The raw Authorization header is passed straight to the DB lookup.',
  fixPrompt: 'In src/auth/session.ts line 42, strip the "Bearer " prefix and verify the token before lookup.',
  suggestion: null,
};

describe('LlmReview', () => {
  it('accepts a valid review', () => {
    const result = LlmReview.safeParse({ summary: 'Adds session lookup.', findings: [validFinding] });
    expect(result.success).toBe(true);
  });

  it('accepts an empty findings array', () => {
    expect(LlmReview.safeParse({ summary: 'Looks good.', findings: [] }).success).toBe(true);
  });

  it('rejects an unknown severity', () => {
    const result = LlmReview.safeParse({
      summary: 'x',
      findings: [{ ...validFinding, severity: 'blocker' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing nullable key (must be null, not absent)', () => {
    const { suggestion: _omitted, ...withoutSuggestion } = validFinding;
    const result = LlmReview.safeParse({ summary: 'x', findings: [withoutSuggestion] });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer line', () => {
    const result = LlmReview.safeParse({ summary: 'x', findings: [{ ...validFinding, line: 4.5 }] });
    expect(result.success).toBe(false);
  });
});

describe('Finding', () => {
  it('requires placement', () => {
    expect(Finding.safeParse(validFinding).success).toBe(false);
    expect(Finding.safeParse({ ...validFinding, placement: 'inline' }).success).toBe(true);
  });
});
