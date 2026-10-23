import { describe, expect, it } from 'vitest';
import type { LlmFinding } from '@diffy/shared';
import { buildCommentableIndex } from '../src/diff.js';
import { MAX_FINDINGS, placeFinding, placeFindings } from '../src/placement.js';

// hunk 0 -> new lines 10-12, hunk 1 -> new lines 41-42
const index = buildCommentableIndex([
  {
    path: 'src/auth.ts',
    patch: ['@@ -10,3 +10,4 @@', ' a', '+b', ' c', '@@ -40,2 +41,2 @@', '-old', '+fresh', ' end'].join('\n'),
  },
  { path: 'logo.png', patch: undefined },
]);

const finding = (over: Partial<LlmFinding> = {}): LlmFinding => ({
  path: 'src/auth.ts',
  startLine: null,
  line: 11,
  severity: 'high',
  title: 't',
  explanation: 'e',
  fixPrompt: 'f',
  suggestion: 'fixed();',
  ...over,
});

describe('placeFinding', () => {
  it('places a line inside a hunk inline', () => {
    expect(placeFinding(finding(), index)).toMatchObject({ placement: 'inline', line: 11, suggestion: 'fixed();' });
  });

  it('moves an unknown path to the summary', () => {
    expect(placeFinding(finding({ path: 'other.ts' }), index).placement).toBe('summary');
  });

  it('moves a file without a patch to the summary', () => {
    expect(placeFinding(finding({ path: 'logo.png', line: 1 }), index).placement).toBe('summary');
  });

  it('moves a line outside every hunk to the summary and keeps its suggestion', () => {
    expect(placeFinding(finding({ line: 30 }), index)).toMatchObject({ placement: 'summary', suggestion: 'fixed();' });
  });

  it('keeps a valid range inline with its suggestion', () => {
    expect(placeFinding(finding({ startLine: 10, line: 12 }), index)).toMatchObject({
      placement: 'inline',
      startLine: 10,
      suggestion: 'fixed();',
    });
  });

  it('collapses a range that crosses two hunks to the end line, dropping the suggestion', () => {
    expect(placeFinding(finding({ startLine: 12, line: 41 }), index)).toMatchObject({
      placement: 'inline',
      line: 41,
      startLine: null,
      suggestion: null,
    });
  });

  it('collapses a range whose start is outside the diff', () => {
    expect(placeFinding(finding({ startLine: 5, line: 11 }), index)).toMatchObject({
      placement: 'inline',
      startLine: null,
      suggestion: null,
    });
  });

  it('collapses a reversed range (startLine >= line)', () => {
    expect(placeFinding(finding({ startLine: 12, line: 10 }), index)).toMatchObject({
      placement: 'inline',
      line: 10,
      startLine: null,
      suggestion: null,
    });
  });
});

describe('placeFindings', () => {
  it('sorts by severity, most severe first', () => {
    const result = placeFindings(
      [finding({ severity: 'low' }), finding({ severity: 'critical' }), finding({ severity: 'medium' })],
      index,
    );
    expect(result.map((f) => f.severity)).toEqual(['critical', 'medium', 'low']);
  });

  it('caps the number of findings, dropping the least severe', () => {
    const many = [
      ...Array.from({ length: MAX_FINDINGS }, () => finding({ severity: 'low' })),
      finding({ severity: 'critical' }),
    ];
    const result = placeFindings(many, index);
    expect(result).toHaveLength(MAX_FINDINGS);
    expect(result[0]!.severity).toBe('critical');
  });
});
