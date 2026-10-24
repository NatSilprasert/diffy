import { z } from 'zod';

// Where a review is in its life. QUEUED -> RUNNING -> POSTED or FAILED; SKIPPED means there was nothing to review.
export const ReviewStatus = z.enum(['queued', 'running', 'posted', 'failed', 'skipped']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;
