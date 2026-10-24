import { Injectable } from '@nestjs/common';
import type { Review } from '../../generated/prisma/client';
import { isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';

type NewReview = {
  repositoryId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  headSha: string;
};

@Injectable()
export class ReviewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // The unique (repository, PR, head commit) constraint is what stops the same commit being reviewed
  // twice, even if two requests race. On a duplicate this returns the row that is already there.
  async createQueued(data: NewReview): Promise<{ review: Review; created: boolean }> {
    try {
      return { review: await this.prisma.review.create({ data }), created: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const { repositoryId, prNumber, headSha } = data;
      const existing = await this.prisma.review.findUnique({
        where: { repositoryId_prNumber_headSha: { repositoryId, prNumber, headSha } },
      });
      if (!existing) throw err;
      return { review: existing, created: false };
    }
  }
}
