import { Injectable, Logger } from '@nestjs/common';
import { RunReviewService } from './run-review.service';

// An in-memory queue that runs one review at a time. Nothing is stored here: a queued or running
// review is a row in the database, so a restart can pick up whatever was left unfinished.
@Injectable()
export class ReviewQueueService {
  private readonly logger = new Logger(ReviewQueueService.name);
  private readonly pending: string[] = [];
  private current: string | null = null;
  private draining: Promise<void> | null = null;

  constructor(private readonly runReview: RunReviewService) {}

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
