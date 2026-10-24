const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// Largest first, so the first unit that fits is the right one.
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

// "3 minutes ago", for a timestamp the server sent as an ISO string.
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Number.isNaN(seconds)) return '';
  // Under a minute, and anything in the future (the clocks of the server and the browser can differ).
  if (seconds > -45) return 'just now';

  for (const [unit, size] of UNITS) {
    if (-seconds >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(Math.round(seconds / 60), 'minute');
}
