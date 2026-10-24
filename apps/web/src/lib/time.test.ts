import { describe, expect, it } from 'vitest';
import { timeAgo } from './time';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('timeAgo', () => {
  it('says "just now" for less than a minute', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now');
    expect(timeAgo(ago(30), NOW)).toBe('just now');
    expect(timeAgo(ago(44), NOW)).toBe('just now');
  });

  it.each([
    [60, '1 minute ago'],
    [5 * 60, '5 minutes ago'],
    [59 * 60, '59 minutes ago'],
    [3600, '1 hour ago'],
    [5 * 3600, '5 hours ago'],
    [24 * 3600, 'yesterday'],
    [3 * 24 * 3600, '3 days ago'],
    [45 * 24 * 3600, 'last month'],
    [200 * 24 * 3600, '7 months ago'],
    [400 * 24 * 3600, 'last year'],
  ])('%i seconds ago -> %s', (seconds, expected) => {
    expect(timeAgo(ago(seconds), NOW)).toBe(expected);
  });

  it('treats a time in the future as "just now" instead of "in 3 minutes"', () => {
    expect(timeAgo(ago(-180), NOW)).toBe('just now');
  });

  it('returns an empty string for something that is not a date', () => {
    expect(timeAgo('not a date', NOW)).toBe('');
    expect(timeAgo('', NOW)).toBe('');
  });
});
