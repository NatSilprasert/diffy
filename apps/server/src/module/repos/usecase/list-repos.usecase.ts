import { Injectable } from '@nestjs/common';
import type { ListReposResponseDto } from '../dto/list-repos.dto';
import { toRepoItem } from '../repos.mapper';
import { ReposRepository } from '../repos.repository';

@Injectable()
export class ListReposUsecase {
  constructor(private readonly reposRepository: ReposRepository) {}

  async execute(): Promise<ListReposResponseDto> {
    const repos = await this.reposRepository.findAll();
    return { repos: repos.map(toRepoItem) };
  }
}
