import { createGithubClient, listAccessibleRepos, type AccessibleRepo } from '@diffy/core';
import { Injectable } from '@nestjs/common';
import { toGithubHttpException } from '../../../infra/github/github-errors';
import { SettingsService } from '../../settings/settings.service';
import type { ListAvailableReposQueryDto, ListAvailableReposResponseDto } from '../dto/list-available-repos.dto';

export const MAX_AVAILABLE_REPOS_RETURNED = 50;

@Injectable()
export class ListAvailableReposUsecase {
  constructor(private readonly settingsService: SettingsService) {}

  async execute(input: ListAvailableReposQueryDto): Promise<ListAvailableReposResponseDto> {
    const token = await this.settingsService.getGithubToken();

    let repos: AccessibleRepo[];
    try {
      repos = await listAccessibleRepos(createGithubClient(token));
    } catch (err) {
      throw toGithubHttpException(err, {
        rejected: 'GitHub rejected the saved token. Enter a new one in Settings.',
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
