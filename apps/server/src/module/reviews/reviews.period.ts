import type { ReviewPeriod } from './dto/review-period.schema';

// The moment a period started, as seen from `now`. Week and month follow the calendar of the machine
// that runs the server, which for a self-hosted app is the machine the person is sitting at.
export function periodStart(period: ReviewPeriod, now: Date = new Date()): Date {
  switch (period) {
    case 'day':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'week': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysSinceMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysSinceMonday);
      return start;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
