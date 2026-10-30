import { getRepository, listOpenPullRequests, type RepositoryInfo } from '@diffy/core';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { toGithubHttpException } from '../../../infra/github/github-errors';
import { AccountsService } from '../../accounts/accounts.service';
import { GithubService } from '../../github/github.service';
import type { AddRepoRequestDto, AddRepoResponseDto } from '../dto/add-repo.dto';
import { toRepoItem } from '../repos.mapper';
import { ReposRepository } from '../repos.repository';

@Injectable()
export class AddRepoUsecase {
  constructor(
    private readonly reposRepository: ReposRepository,
    private readonly githubService: GithubService,
    private readonly accountsService: AccountsService,
  ) {}

  async execute(accountId: string, input: AddRepoRequestDto): Promise<AddRepoResponseDto> {
    const [owner, name] = input.fullName.split('/') as [string, string];
    const { info, baselineShas } = await this.lookupOnGithub(owner, name);

    if (info.archived) {
      throw new BadRequestException(`${info.fullName} is archived, so GitHub does not allow reviews on it.`);
    }

    // A repository belongs to the account that owns it, and a person adds it from that account: for an organization's
    // repository they switch to the organization first.
    const account = await this.accountsService.findById(accountId);
    if (!account || account.login.toLowerCase() !== info.owner.toLowerCase()) {
      throw new NotFoundException(`${info.fullName} does not belong to ${account?.login ?? 'this account'}. Switch to the account that owns it to add it.`);
    }

    // Saved with GitHub's casing, so "Acme/API" and "acme/api" cannot become two entries.
    const created = await this.reposRepository.add({ accountId, owner: info.owner, name: info.name, baselineShas });
    if (!created) throw new ConflictException(`${info.fullName} is already being watched.`);
    return toRepoItem(created);
  }

  // Check with GitHub first: a typo, or a repo the token cannot see, should fail now, not silently
  // never produce a review.
  // It also notes the head commit of every pull request that is open right now. Those are the baseline:
  // not reviewed automatically, otherwise adding a repo would review all of its open PRs at once. If this
  // cannot be read, the repo is not added at all, because saving it without a baseline would do exactly that.
  private async lookupOnGithub(owner: string, name: string): Promise<{ info: RepositoryInfo; baselineShas: string[] }> {
    try {
      const { octokit } = await this.githubService.getAccess(owner, name);
      const info = await getRepository(octokit, owner, name);
      const openPulls = await listOpenPullRequests(octokit, info.owner, info.name);
      return { info, baselineShas: openPulls.map((pr) => pr.headSha) };
    } catch (err) {
      throw toGithubHttpException(err, {
        notFound: `${owner}/${name} was not found, or the diffy GitHub App is not installed on it. Install the App from Settings and give it this repository.`,
        rejected: 'GitHub rejected the diffy GitHub App. Check its settings on GitHub.',
        unreachable: 'Could not reach GitHub to check the repository. Try again in a moment.',
      });
    }
  }
}
