export type Severity = 'critical' | 'high' | 'medium' | 'low';

// Most severe first: the order a person should read them in.
export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low'];

// Groups findings by severity in reading order. A severity with no findings is left out.
// Within a group, the order the server sent them in (file, then line) is kept.
export function groupBySeverity<T extends { severity: Severity }>(findings: readonly T[]): Array<{ severity: Severity; findings: T[] }> {
  return SEVERITY_ORDER.map((severity) => ({ severity, findings: findings.filter((f) => f.severity === severity) })).filter(
    (group) => group.findings.length > 0,
  );
}

// "src/auth.ts:42" for one line, "src/auth.ts:40-42" for a range.
export function formatLocation(finding: { path: string; startLine: number | null; line: number }): string {
  return finding.startLine === null || finding.startLine === finding.line
    ? `${finding.path}:${finding.line}`
    : `${finding.path}:${finding.startLine}-${finding.line}`;
}
