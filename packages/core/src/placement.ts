import type { Finding, LlmFinding, Severity } from '@diffy/shared';
import type { CommentableIndex } from './diff.js';

export const MAX_FINDINGS = 25;

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function hunkIdOf(index: CommentableIndex, path: string, line: number): number | undefined {
  return index.get(path)?.find((h) => h.lines.has(line))?.hunkId;
}

// GitHub rejects the whole review if one inline comment points outside the diff,
// so every finding is checked here and moved to the summary when it can't be inline.
export function placeFinding(finding: LlmFinding, index: CommentableIndex): Finding {
  const lineHunk = hunkIdOf(index, finding.path, finding.line);
  if (lineHunk === undefined) return { ...finding, placement: 'summary' };

  if (finding.startLine === null) return { ...finding, placement: 'inline' };

  const validRange =
    finding.startLine < finding.line && hunkIdOf(index, finding.path, finding.startLine) === lineHunk;
  if (validRange) return { ...finding, placement: 'inline' };

  // Bad range but a good end line: keep it inline on a single line. The suggestion was written
  // for the whole range, so it would replace the wrong lines and has to go.
  return { ...finding, startLine: null, suggestion: null, placement: 'inline' };
}

export function placeFindings(findings: LlmFinding[], index: CommentableIndex): Finding[] {
  return [...findings]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_FINDINGS)
    .map((f) => placeFinding(f, index));
}
