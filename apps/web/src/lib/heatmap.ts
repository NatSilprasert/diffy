export type Day = { date: string; count: number };

export type Heatmap = {
  // Columns are weeks, oldest first. Each has 7 cells, Sunday first; null is a day before the first or after the last.
  weeks: Array<Array<Day | null>>;
  // The month name above the first column of each month, or null where there is none.
  monthLabels: Array<string | null>;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Lays the days out like GitHub's contribution graph. `date` is "YYYY-MM-DD" and the list is in date order.
export function buildHeatmap(days: readonly Day[]): Heatmap {
  if (days.length === 0) return { weeks: [], monthLabels: [] };

  const [y, m, d] = days[0]!.date.split('-').map(Number) as [number, number, number];
  const leading = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  const cells: Array<Day | null> = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<Day | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // A column is named after the month of its first day, when that differs from the column before it.
  const monthOf = (week: Array<Day | null>) => Number(week.find((cell) => cell !== null)!.date.slice(5, 7)) - 1;
  const monthLabels = weeks.map((week, i) => (i === 0 || monthOf(week) !== monthOf(weeks[i - 1]!) ? MONTHS[monthOf(week)]! : null));
  // The first column is often a few days of a month that ends right after: two names would sit on top of each other.
  const next = monthLabels.findIndex((label, i) => i > 0 && label !== null);
  if (next !== -1 && next < 3) monthLabels[0] = null;

  return { weeks, monthLabels };
}

// 0 for no reviews, then 1 to 4 by how close the day is to the busiest day.
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}
