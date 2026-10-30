import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import type {
  UpdateProfileNotesParamsDto,
  UpdateProfileNotesRequestDto,
  UpdateProfileNotesResponseDto,
} from '../dto/update-profile-notes.dto';
import { toProfileItem } from '../profiles.mapper';
import { ProfilesRepository } from '../profiles.repository';

@Injectable()
export class UpdateProfileNotesUsecase {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly reposService: ReposService,
  ) {}

  async execute(accountId: string, params: UpdateProfileNotesParamsDto, input: UpdateProfileNotesRequestDto): Promise<UpdateProfileNotesResponseDto> {
    await this.reposService.getAccountRepo(params.repositoryId, accountId);
    if (!(await this.profilesRepository.updateNotes(params.repositoryId, input.notes.trim()))) {
      throw new ConflictException('This repository has no profile yet, so there is nowhere to keep notes. Try again in a minute.');
    }
    const profile = await this.profilesRepository.findByRepositoryId(params.repositoryId);
    if (!profile) throw new NotFoundException('This repository has no profile yet.');
    return toProfileItem(profile);
  }
}
