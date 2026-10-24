import { Injectable } from '@nestjs/common';
import type { GetStatusResponseDto } from '../dto/get-status.dto';
import { ReviewsRepository } from '../reviews.repository';
import { PollerService } from '../worker/poller.service';
import { ReviewQueueService } from '../worker/review-queue.service';

// What the background worker is doing right now. This is live, in-memory state of this server process,
// so it is only meaningful while exactly one instance runs.
@Injectable()
export class GetStatusUsecase {
  constructor(
    private readonly reviewQueue: ReviewQueueService,
    private readonly poller: PollerService,
    private readonly reviewsRepository: ReviewsRepository,
  ) {}

  async execute(): Promise<GetStatusResponseDto> {
    const { queued, current } = this.reviewQueue.getState();
    const running = current ? await this.reviewsRepository.findForRun(current) : null;
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
