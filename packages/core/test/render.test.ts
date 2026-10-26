import { describe, expect, it } from 'vitest';
import type { Finding } from '@diffy/shared';
import { MAX_BODY_CHARS, renderInlineComment, renderSummary } from '../src/render.js';

const finding = (over: Partial<Finding> = {}): Finding => ({
  path: 'src/auth.ts',
  startLine: null,
  line: 11,
  severity: 'high',
  title: 'Token not validated',
  explanation: 'The header is passed straight to the lookup.',
  fixPrompt: 'In src/auth.ts line 11, validate the token first.',
  suggestion: null,
  placement: 'inline',
  ...over,
});

const base = { summary: 'Adds login.', skipped: [], model: 'openai/gpt-x', headSha: 'abcdef1234567' };

describe('renderInlineComment', () => {
  it('has severity, title, explanation and a collapsed fix prompt', () => {
    const body = renderInlineComment(finding());
    expect(body).toContain('**🟠 High — Token not validated**');
    expect(body).toContain('The header is passed straight to the lookup.');
    expect(body).toContain('<summary>Fix prompt for your coding agent</summary>');
    expect(body).not.toContain('```suggestion');
  });

  it('adds a suggestion block only when there is a suggestion', () => {
    const body = renderInlineComment(finding({ suggestion: 'const t = verify(token);\n' }));
    expect(body).toContain('```suggestion\nconst t = verify(token);\n```');
  });

  it('uses a longer fence when the content has backticks', () => {
    const body = renderInlineComment(finding({ suggestion: 'const s = ```x```;' }));
    expect(body).toContain('````suggestion\nconst s = ```x```;\n````');
  });

  it('keeps an empty suggestion, which deletes the lines', () => {
    expect(renderInlineComment(finding({ suggestion: '' }))).toContain('```suggestion\n\n```');
  });
});

describe('renderSummary config notes', () => {
  it('lists the problems with the repository settings, collapsed', () => {
    const body = renderSummary({ ...base, findings: [], configNotes: ['.diffy.yaml: language must be "en" or "th", not "fr". Using "en".'] });
    expect(body).toContain('<summary>1 problem(s) with the diffy settings of this repository</summary>');
    expect(body).toContain('- .diffy.yaml: language must be');
  });

  it('has no such section without notes', () => {
    expect(renderSummary({ ...base, findings: [], configNotes: [] })).not.toContain('settings of this repository');
    expect(renderSummary({ ...base, findings: [] })).not.toContain('settings of this repository');
  });
});

describe('renderSummary', () => {
  it('says so when there are no findings', () => {
    const body = renderSummary({ ...base, findings: [] });
    expect(body).toContain('No issues found.');
    expect(body).toContain('Reviewed `abcdef1`');
    expect(body).not.toContain('| Severity |');
  });

  it('counts by severity and lists inline findings as one-liners', () => {
    const body = renderSummary({
      ...base,
      findings: [finding(), finding({ severity: 'low', line: 12, title: 'Minor' })],
    });
    expect(body).toContain('| 🟠 High | 1 |');
    expect(body).toContain('| 🔵 Low | 1 |');
    expect(body).toContain('### Inline comments (2)');
    expect(body).toContain('- 🟠 `src/auth.ts:11` — Token not validated');
  });

  it('shows outside-the-diff findings in full, with the suggestion as plain code', () => {
    const body = renderSummary({
      ...base,
      findings: [finding({ placement: 'summary', startLine: 5, line: 9, suggestion: 'fixed();' })],
    });
    expect(body).toContain('### Findings outside the changed lines (1)');
    expect(body).toContain('`src/auth.ts:5-9`');
    expect(body).toContain('fixed();');
    expect(body).not.toContain('```suggestion');
    expect(body).not.toContain('### Inline comments');
  });

  it('lists skipped files', () => {
    const body = renderSummary({ ...base, findings: [], skipped: [{ path: 'pnpm-lock.yaml', reason: 'lockfile' }] });
    expect(body).toContain('1 file(s) not reviewed');
    expect(body).toContain('- `pnpm-lock.yaml` (lockfile)');
  });

  it('truncates a body over the size limit and says so', () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      finding({ placement: 'summary', title: `Issue ${i}`, explanation: 'x'.repeat(1000) }),
    );
    const body = renderSummary({ ...base, findings: many });
    expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS + 200);
    expect(body).toContain('truncated');
  });
});
