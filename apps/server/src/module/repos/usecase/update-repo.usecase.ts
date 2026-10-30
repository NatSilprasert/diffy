import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateRepoParamsDto, UpdateRepoRequestDto, UpdateRepoResponseDto } from '../dto/update-repo.dto';
import { toRepoItem } from '../repos.mapper';
import { ReposRepository } from '../repos.repository';

@Injectable()
export class UpdateRepoUsecase {
  constructor(private readonly reposRepository: ReposRepository) {}

  async execute(accountId: string, params: UpdateRepoParamsDto, input: UpdateRepoRequestDto): Promise<UpdateRepoResponseDto> {
    const updated = await this.reposRepository.updateEnabled(params.id, accountId, input.enabled);
    if (!updated) throw new NotFoundException('Repository not found.');
    return toRepoItem(updated);
  }
}
