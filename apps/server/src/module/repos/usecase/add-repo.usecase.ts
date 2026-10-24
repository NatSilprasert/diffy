import { createGithubClient, getRepository, type RepositoryInfo } from '@diffy/core';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    const info = await this.lookupOnGithub(owner, name);

    if (info.archived) {
      throw new BadRequestException(`${info.fullName} is archived, so GitHub does not allow reviews on it.`);
    }

    // Saved with GitHub's casing, so "Acme/API" and "acme/api" cannot become two entries.
    const created = await this.reposRepository.create({ owner: info.owner, name: info.name });
    if (!created) throw new ConflictException(`${info.fullName} is already being watched.`);
    return toRepoItem(created);
  }

  // Check with GitHub first: a typo, or a repo the token cannot see, should fail now, not silently
  // never produce a review.
  private async lookupOnGithub(owner: string, name: string): Promise<RepositoryInfo> {
    const token = await this.settingsService.getGithubToken();
    try {
      return await getRepository(createGithubClient(token), owner, name);
    } catch (err) {
      if ((err as { status?: number }).status === 404) {
        throw new NotFoundException(`${owner}/${name} was not found, or the saved token cannot access it.`);
      }
      throw toGithubHttpException(err, {
        rejected: 'GitHub rejected the saved token. Enter a new one in Settings.',
        unreachable: 'Could not reach GitHub to check the repository. Try again in a moment.',
      });
    }
  }
}
