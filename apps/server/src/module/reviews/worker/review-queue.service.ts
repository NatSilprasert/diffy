import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ReviewsRepository } from '../reviews.repository';
import { RunReviewService } from './run-review.service';

// An in-memory queue that runs one review at a time. Nothing is stored here: a queued or running
// review is a row in the database, so a restart can pick up whatever was left unfinished.
@Injectable()
export class ReviewQueueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReviewQueueService.name);
  private readonly pending: string[] = [];
  private current: string | null = null;
  private draining: Promise<void> | null = null;

  constructor(
    private readonly runReview: RunReviewService,
    private readonly reviewsRepository: ReviewsRepository,
  ) {}

  // The queue lives in memory, so after a restart it is empty. The database still knows which reviews
  // were waiting or in progress; put them back. (One server instance only: a second instance sharing
  // this database would pick up the first one's running reviews.)
  async onApplicationBootstrap(): Promise<void> {
    try {
      const ids = await this.reviewsRepository.recoverUnfinished();
      ids.forEach((id) => this.enqueue(id));
      if (ids.length > 0) this.logger.log(`Recovered ${ids.length} unfinished review(s) from the database`);
    } catch (err) {
      // Do not stop the server over this; the reviews stay in the database and can be retried.
      this.logger.error(`Could not recover unfinished reviews: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  enqueue(reviewId: string): void {
    if (reviewId === this.current || this.pending.includes(reviewId)) return;
    this.pending.push(reviewId);
    this.draining ??= this.drain();
  }

  getState(): { queued: number; current: string | null } {
    return { queued: this.pending.length, current: this.current };
  }

  // Resolves once everything queued so far has finished.
  idle(): Promise<void> {
    return this.draining ?? Promise.resolve();
  }

  private async drain(): Promise<void> {
    try {
      for (let id = this.pending.shift(); id !== undefined; id = this.pending.shift()) {
        this.current = id;
        try {
          await this.runReview.run(id);
        } catch (err) {
          // run() records review failures itself; this is for the unexpected, such as the database being down.
          this.logger.error(`Review ${id} crashed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } finally {
      this.current = null;
      this.draining = null;
    }
  }
}
