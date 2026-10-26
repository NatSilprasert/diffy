import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import type { RebuildProfileParamsDto, RebuildProfileResponseDto } from '../dto/rebuild-profile.dto';
import { toProfileItem } from '../profiles.mapper';
import { ProfilesRepository } from '../profiles.repository';
import { ProfileBuilderService } from '../worker/profile-builder.service';

@Injectable()
export class RebuildProfileUsecase {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly reposService: ReposService,
    private readonly builder: ProfileBuilderService,
  ) {}

  async execute(params: RebuildProfileParamsDto): Promise<RebuildProfileResponseDto> {
    const { repositoryId } = params;
    await this.reposService.getActiveRepo(repositoryId);

    // No profile yet: this is the first build. Otherwise the existing one goes back to building (its content and
    // the notes stay until the new content is ready). A build that is running is not started a second time.
    const started = (await this.profilesRepository.createBuilding(repositoryId)) || (await this.profilesRepository.markBuildingIfIdle(repositoryId));
    if (!started) throw new ConflictException('The profile is already being built.');

    this.builder.enqueue(repositoryId);
    const profile = await this.profilesRepository.findByRepositoryId(repositoryId);
    if (!profile) throw new NotFoundException('This repository has no profile.');
    return toProfileItem(profile);
  }
}
