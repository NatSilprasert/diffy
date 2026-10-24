import { createGithubClient, getRepository, listOpenPullRequests, type RepositoryInfo } from '@diffy/core';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { toGithubHttpException } from '../../../infra/github/github-errors';
import { SettingsService } from '../../settings/settings.service';
import type { AddRepoRequestDto, AddRepoResponseDto } from '../dto/add-repo.dto';
import { toRepoItem } from '../repos.mapper';
import { ReposRepository } from '../repos.repository';

@Injectable()
export class AddRepoUsecase {
  constructor(
    private readonly reposRepository: ReposRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async execute(input: AddRepoRequestDto): Promise<AddRepoResponseDto> {
    const [owner, name] = input.fullName.split('/') as [string, string];
    const { info, baselineShas } = await this.lookupOnGithub(owner, name);

    if (info.archived) {
      throw new BadRequestException(`${info.fullName} is archived, so GitHub does not allow reviews on it.`);
    }

    // Saved with GitHub's casing, so "Acme/API" and "acme/api" cannot become two entries.
    const created = await this.reposRepository.add({ owner: info.owner, name: info.name, baselineShas });
    if (!created) throw new ConflictException(`${info.fullName} is already being watched.`);
    return toRepoItem(created);
  }

  // Check with GitHub first: a typo, or a repo the token cannot see, should fail now, not silently
  // never produce a review.
  // It also notes the head commit of every pull request that is open right now. Those are the baseline:
  // not reviewed automatically, otherwise adding a repo would review all of its open PRs at once. If this
  // cannot be read, the repo is not added at all, because saving it without a baseline would do exactly that.
  private async lookupOnGithub(owner: string, name: string): Promise<{ info: RepositoryInfo; baselineShas: string[] }> {
    const token = await this.settingsService.getGithubToken();
    try {
      const octokit = createGithubClient(token);
      const info = await getRepository(octokit, owner, name);
      const openPulls = await listOpenPullRequests(octokit, info.owner, info.name);
      return { info, baselineShas: openPulls.map((pr) => pr.headSha) };
    } catch (err) {
      throw toGithubHttpException(err, {
        notFound: `${owner}/${name} was not found, or the saved token cannot access it.`,
        rejected: 'GitHub rejected the saved token. Enter a new one in Settings.',
        unreachable: 'Could not reach GitHub to check the repository. Try again in a moment.',
      });
    }
  }
}
