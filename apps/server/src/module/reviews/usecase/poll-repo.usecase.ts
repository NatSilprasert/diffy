import { Injectable } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import type { PollRepoRequestDto, PollRepoResponseDto } from '../dto/poll-repo.dto';
import { PollerWorker } from '../worker/poller.worker';

// "Check now": the same poll the timer runs, for one repository, on request.
@Injectable()
export class PollRepoUsecase {
  constructor(
    private readonly reposService: ReposService,
    private readonly poller: PollerWorker,
  ) {}

  async execute(input: PollRepoRequestDto): Promise<PollRepoResponseDto> {
    const repo = await this.reposService.getActiveRepo(input.repositoryId);
    return this.poller.pollRepo(repo);
  }
}
