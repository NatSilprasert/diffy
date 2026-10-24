import { ReviewStatus } from '@diffy/shared';
import { describe, expect, it } from 'vitest';
import { ReviewStatus as DbReviewStatus } from '../src/generated/prisma/enums';
import { toApiStatus } from '../src/module/reviews/reviews.mapper';

describe('toApiStatus', () => {
  it('maps every database status to a valid API status', () => {
    for (const status of Object.values(DbReviewStatus)) {
      expect(ReviewStatus.safeParse(toApiStatus(status)).success).toBe(true);
    }
  });

  it('is simply the lower-case spelling', () => {
    for (const status of Object.values(DbReviewStatus)) {
      expect(toApiStatus(status)).toBe(status.toLowerCase());
    }
  });
});
