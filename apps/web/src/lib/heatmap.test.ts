import { describe, expect, it } from 'vitest';
import { buildHeatmap, heatLevel, type Day } from './heatmap';

// Consecutive days starting at a given date.
function run(start: [number, number, number], length: number): Day[] {
  return Array.from({ length }, (_, i) => {
    const d = new Date(start[0], start[1] - 1, start[2] + i);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, count: 0 };
  });
}

describe('buildHeatmap', () => {
  it('is empty for no days', () => {
    expect(buildHeatmap([])).toEqual({ weeks: [], monthLabels: [] });
  });

  it('puts Sunday first and pads the first week with the days before the start', () => {
    // 2026-10-21 is a Wednesday: Sunday and Monday and Tuesday are empty.
    const { weeks } = buildHeatmap(run([2026, 10, 21], 10));
    expect(weeks[0]!.slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0]![3]!.date).toBe('2026-10-21');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('pads the last week with the days after today', () => {
    const { weeks } = buildHeatmap(run([2026, 10, 18], 3)); // Sun, Mon, Tue
    expect(weeks).toHaveLength(1);
    expect(weeks[0]!.slice(3)).toEqual([null, null, null, null]);
  });

  it('names a column when a new month starts and not before', () => {
    const { monthLabels } = buildHeatmap(run([2026, 8, 30], 90)); // 30 Aug to 27 Nov
    expect(monthLabels.filter((l) => l !== null)).toEqual(['Sep', 'Oct', 'Nov']);
  });

  it('drops the first name when the next month follows it straight away', () => {
    // The first column holds the last days of a month, and the next column already starts the following one.
    const { monthLabels } = buildHeatmap(run([2026, 10, 28], 14));
    expect(monthLabels[0]).toBeNull();
  });
});

describe('heatLevel', () => {
  it('is 0 for an empty day or an empty year', () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(5, 0)).toBe(0);
  });

  it('scales by the busiest day, at least 1 for any review and 4 for the busiest', () => {
    expect(heatLevel(1, 100)).toBe(1);
    expect(heatLevel(30, 100)).toBe(2);
    expect(heatLevel(60, 100)).toBe(3);
    expect(heatLevel(100, 100)).toBe(4);
  });
});
