import { Injectable } from '@nestjs/common';
import type { GetStatusResponseDto } from '../dto/get-status.dto';
import { ReviewsRepository } from '../reviews.repository';
import { PollerWorker } from '../worker/poller.worker';
import { ReviewQueueWorker } from '../worker/review-queue.worker';

// What the background worker is doing right now. This is live, in-memory state of this server process,
// so it is only meaningful while exactly one instance runs.
@Injectable()
export class GetStatusUsecase {
  constructor(
    private readonly reviewQueue: ReviewQueueWorker,
    private readonly poller: PollerWorker,
    private readonly reviewsRepository: ReviewsRepository,
  ) {}

  async execute(accountId: string): Promise<GetStatusResponseDto> {
    const { queued, current } = this.reviewQueue.getState();
    // The queue is shared by every account, but what is being reviewed is only shown to the account it belongs to.
    const found = current ? await this.reviewsRepository.findForRun(current) : null;
    const running = found && found.repository.accountId === accountId ? found : null;
    const poller = this.poller.getState();

    return {
      queue: {
        waiting: queued,
        current: running
          ? {
              reviewId: running.id,
              repoFullName: `${running.repository.owner}/${running.repository.name}`,
              prNumber: running.prNumber,
              prTitle: running.prTitle,
            }
          : null,
      },
      poller: {
        intervalSeconds: poller.intervalSeconds,
        running: poller.running,
        lastRunAt: poller.lastRunAt?.toISOString() ?? null,
        nextRunAt: poller.nextRunAt?.toISOString() ?? null,
      },
    };
  }
}
