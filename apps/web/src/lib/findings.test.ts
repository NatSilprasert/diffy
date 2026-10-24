import { describe, expect, it } from 'vitest';
import { formatLocation, groupBySeverity, type Severity } from './findings';

const f = (id: string, severity: Severity) => ({ id, severity });

describe('groupBySeverity', () => {
  it('orders groups from critical to low whatever order the findings arrive in', () => {
    const groups = groupBySeverity([f('a', 'low'), f('b', 'critical'), f('c', 'medium'), f('d', 'high')]);
    expect(groups.map((g) => g.severity)).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('leaves out severities that have no findings', () => {
    expect(groupBySeverity([f('a', 'high'), f('b', 'low')]).map((g) => g.severity)).toEqual(['high', 'low']);
  });

  it('keeps the incoming order inside a group', () => {
    const groups = groupBySeverity([f('first', 'high'), f('x', 'low'), f('second', 'high'), f('third', 'high')]);
    expect(groups[0]!.findings.map((x) => x.id)).toEqual(['first', 'second', 'third']);
  });

  it('returns no groups for no findings', () => {
    expect(groupBySeverity([])).toEqual([]);
  });
});

describe('formatLocation', () => {
  it('shows a single line', () => {
    expect(formatLocation({ path: 'src/auth.ts', startLine: null, line: 42 })).toBe('src/auth.ts:42');
  });

  it('shows a range', () => {
    expect(formatLocation({ path: 'src/auth.ts', startLine: 40, line: 42 })).toBe('src/auth.ts:40-42');
  });

  it('does not show a range that starts and ends on the same line', () => {
    expect(formatLocation({ path: 'a.ts', startLine: 7, line: 7 })).toBe('a.ts:7');
  });
});
