import type { AccessibleRepo } from '@diffy/core';
import { Injectable } from '@nestjs/common';
import { toGithubHttpException } from '../../../infra/github/github-errors';
import { GithubService } from '../../github/github.service';
import type { ListAvailableReposQueryDto, ListAvailableReposResponseDto } from '../dto/list-available-repos.dto';

export const MAX_AVAILABLE_REPOS_RETURNED = 50;

@Injectable()
export class ListAvailableReposUsecase {
  constructor(private readonly githubService: GithubService) {}

  async execute(accountId: string, input: ListAvailableReposQueryDto): Promise<ListAvailableReposResponseDto> {
    let repos: AccessibleRepo[];
    try {
      repos = await this.githubService.listRepos(accountId);
    } catch (err) {
      throw toGithubHttpException(err, {
        rejected: 'GitHub rejected the diffy GitHub App. Check its settings on GitHub.',
        unreachable: 'Could not reach GitHub to list repositories. Try again in a moment.',
      });
    }

    const query = input.q?.toLowerCase();
    const matches = query ? repos.filter((repo) => repo.fullName.toLowerCase().includes(query)) : repos;
    return {
      repos: matches.slice(0, MAX_AVAILABLE_REPOS_RETURNED),
      hasMore: matches.length > MAX_AVAILABLE_REPOS_RETURNED,
    };
  }
}
