import { z } from 'zod';

// The time windows the reviews page counts and filters by.
// day = the last 24 hours, week = since Monday 00:00, month = since the 1st 00:00 (server's local time).
export const ReviewPeriod = z.enum(['day', 'week', 'month']);
export type ReviewPeriod = z.infer<typeof ReviewPeriod>;
