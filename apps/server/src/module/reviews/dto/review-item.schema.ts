import { ReviewStatus } from '@diffy/shared';
import { z } from 'zod';

// The shape of one review, shared by the endpoints that return it.
export const ReviewItemSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  prNumber: z.number().int(),
  prTitle: z.string(),
  prUrl: z.string(),
  headSha: z.string(),
  status: ReviewStatus,
  error: z.string().describe('Why the review failed; null otherwise').nullable(),
  githubReviewUrl: z.string().describe('Link to the posted review on GitHub; null until it is posted').nullable(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
