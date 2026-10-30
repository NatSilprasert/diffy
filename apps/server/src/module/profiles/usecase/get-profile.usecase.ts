import { Injectable, NotFoundException } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import type { GetProfileParamsDto, GetProfileResponseDto } from '../dto/get-profile.dto';
import { toProfileItem } from '../profiles.mapper';
import { ProfilesRepository } from '../profiles.repository';

@Injectable()
export class GetProfileUsecase {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly reposService: ReposService,
  ) {}

  async execute(accountId: string, params: GetProfileParamsDto): Promise<GetProfileResponseDto> {
    await this.reposService.getAccountRepo(params.repositoryId, accountId);
    const profile = await this.profilesRepository.findByRepositoryId(params.repositoryId);
    // A repository that was just added has none for a moment: the poller starts it on its next pass.
    if (!profile) throw new NotFoundException('This repository has no profile yet.');
    return toProfileItem(profile);
  }
}
