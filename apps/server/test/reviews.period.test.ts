import { describe, expect, it } from 'vitest';
import { periodStart } from '../src/module/reviews/reviews.period';

// Wednesday 2026-10-21 15:30 in the local time of whatever machine runs the tests.
const now = new Date(2026, 9, 21, 15, 30, 0);

describe('periodStart', () => {
  it('day is exactly 24 hours back', () => {
    expect(periodStart('day', now).getTime()).toBe(now.getTime() - 24 * 3600 * 1000);
  });

  it('week starts on the Monday before, at midnight', () => {
    expect(periodStart('week', now)).toEqual(new Date(2026, 9, 19, 0, 0, 0));
  });

  it('week on a Monday starts that same morning', () => {
    expect(periodStart('week', new Date(2026, 9, 19, 9, 0, 0))).toEqual(new Date(2026, 9, 19, 0, 0, 0));
  });

  it('week on a Sunday reaches back to the Monday six days before', () => {
    expect(periodStart('week', new Date(2026, 9, 25, 23, 0, 0))).toEqual(new Date(2026, 9, 19, 0, 0, 0));
  });

  it('week can start in the previous month', () => {
    // Sunday 1 Nov 2026: the week began Monday 26 Oct.
    expect(periodStart('week', new Date(2026, 10, 1, 12, 0, 0))).toEqual(new Date(2026, 9, 26, 0, 0, 0));
  });

  it('month starts on the 1st at midnight', () => {
    expect(periodStart('month', now)).toEqual(new Date(2026, 9, 1, 0, 0, 0));
  });
});
