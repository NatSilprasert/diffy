import type { Finding, Severity } from '@diffy/shared';
import type { SkippedFile } from './annotate.js';

// GitHub rejects review bodies over 65,536 characters; stay well under it.
export const MAX_BODY_CHARS = 60_000;

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
const EMOJI: Record<Severity, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
const LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

// Code fence long enough that backticks inside the content can't close it early.
function fence(content: string, lang: string): string {
  const longestRun = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = '`'.repeat(Math.max(3, longestRun + 1));
  return `${ticks}${lang}\n${content.replace(/\n$/, '')}\n${ticks}`;
}

function location(f: Finding): string {
  return f.startLine === null ? `${f.path}:${f.line}` : `${f.path}:${f.startLine}-${f.line}`;
}

function fixPromptBlock(f: Finding): string {
  return `<details>\n<summary>Fix prompt for your coding agent</summary>\n\n${fence(f.fixPrompt, 'text')}\n\n</details>`;
}

// Body of one inline review comment. Only inline findings get a ```suggestion block,
// because GitHub turns it into a "Commit suggestion" button on exactly the commented lines.
export function renderInlineComment(f: Finding): string {
  const parts = [`**${EMOJI[f.severity]} ${LABEL[f.severity]} — ${f.title}**`, f.explanation];
  if (f.suggestion !== null) parts.push(fence(f.suggestion, 'suggestion'));
  parts.push(fixPromptBlock(f));
  return parts.join('\n\n');
}

// A finding that could not be placed inline is shown in full inside the summary.
function renderSummaryFinding(f: Finding): string {
  const parts = [`#### ${EMOJI[f.severity]} ${LABEL[f.severity]} — ${f.title}`, `\`${location(f)}\``, f.explanation];
  if (f.suggestion !== null) parts.push(`Suggested replacement:\n\n${fence(f.suggestion, '')}`);
  parts.push(fixPromptBlock(f));
  return parts.join('\n\n');
}

export type SummaryInput = {
  summary: string;
  findings: Finding[];
  skipped: SkippedFile[];
  model: string;
  headSha: string;
  // Problems found in the repository's .diffy.yaml. Shown so the maintainers can fix the file.
  configNotes?: string[];
};

function truncate(body: string): string {
  if (body.length <= MAX_BODY_CHARS) return body;
  const cut = body.lastIndexOf('\n', MAX_BODY_CHARS);
  return `${body.slice(0, cut > 0 ? cut : MAX_BODY_CHARS)}\n\n_…truncated: the review body hit GitHub's size limit._`;
}

export function renderSummary(input: SummaryInput): string {
  const { findings, skipped } = input;
  const inline = findings.filter((f) => f.placement === 'inline');
  const outside = findings.filter((f) => f.placement === 'summary');

  const parts = ['## diffy review', input.summary];

  if (findings.length === 0) {
    parts.push('No issues found.');
  } else {
    const counts = SEVERITY_ORDER.map((s) => ({ s, n: findings.filter((f) => f.severity === s).length })).filter(
      (c) => c.n > 0,
    );
    parts.push(
      ['| Severity | Count |', '|---|---|', ...counts.map((c) => `| ${EMOJI[c.s]} ${LABEL[c.s]} | ${c.n} |`)].join('\n'),
    );
  }

  if (inline.length > 0) {
    parts.push(
      [
        `### Inline comments (${inline.length})`,
        ...inline.map((f) => `- ${EMOJI[f.severity]} \`${location(f)}\` — ${f.title}`),
      ].join('\n'),
    );
  }

  if (outside.length > 0) {
    parts.push(
      `### Findings outside the changed lines (${outside.length})\n\nThese could not be attached to a line in the diff.`,
    );
    parts.push(...outside.map(renderSummaryFinding));
  }

  if (skipped.length > 0) {
    parts.push(
      [
        `<details>\n<summary>${skipped.length} file(s) not reviewed</summary>\n`,
        ...skipped.map((s) => `- \`${s.path}\` (${s.reason})`),
        '\n</details>',
      ].join('\n'),
    );
  }

  if (input.configNotes && input.configNotes.length > 0) {
    parts.push(
      [`<details>\n<summary>${input.configNotes.length} problem(s) with the diffy settings of this repository</summary>\n`, ...input.configNotes.map((n) => `- ${n}`), '\n</details>'].join('\n'),
    );
  }

  parts.push(`<sub>Reviewed \`${input.headSha.slice(0, 7)}\` with ${input.model}</sub>`);
  return truncate(parts.join('\n\n'));
}
