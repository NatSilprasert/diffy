import { describe, expect, it } from 'vitest';
import { isReviewable } from '../src/module/reviews/review-eligibility';

const pr = (over: Record<string, unknown> = {}) => ({ isDraft: false, authorIsBot: false, headSha: 'abc', ...over });

describe('isReviewable', () => {
  it('reviews an ordinary pull request', () => {
    expect(isReviewable(pr(), [])).toBe(true);
  });

  it('leaves out drafts and bots', () => {
    expect(isReviewable(pr({ isDraft: true }), [])).toBe(false);
    expect(isReviewable(pr({ authorIsBot: true }), [])).toBe(false);
  });

  it('leaves out a commit that was open when the repository was added, but not a newer one', () => {
    expect(isReviewable(pr(), ['abc'])).toBe(false);
    expect(isReviewable(pr({ headSha: 'def' }), ['abc'])).toBe(true);
  });
});
