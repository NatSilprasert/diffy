import { Injectable, NotFoundException } from '@nestjs/common';
import type { RemoveRepoParamsDto } from '../dto/remove-repo.dto';
import { ReposRepository } from '../repos.repository';

@Injectable()
export class RemoveRepoUsecase {
  constructor(private readonly reposRepository: ReposRepository) {}

  async execute(accountId: string, params: RemoveRepoParamsDto): Promise<void> {
    const removed = await this.reposRepository.softRemove(params.id, accountId);
    if (!removed) throw new NotFoundException('Repository not found.');
  }
}
