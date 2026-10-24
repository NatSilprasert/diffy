import { describe, expect, it } from 'vitest';
import { ReviewStatus } from '../src/index.js';

describe('ReviewStatus', () => {
  it('accepts the five lifecycle states', () => {
    for (const status of ['queued', 'running', 'posted', 'failed', 'skipped']) {
      expect(ReviewStatus.safeParse(status).success).toBe(true);
    }
  });

  it('rejects anything else, including the database spelling', () => {
    for (const status of ['QUEUED', 'done', '', 1]) {
      expect(ReviewStatus.safeParse(status).success).toBe(false);
    }
  });
});
