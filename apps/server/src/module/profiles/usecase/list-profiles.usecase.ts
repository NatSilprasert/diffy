import { Injectable } from '@nestjs/common';
import type { ListProfilesResponseDto } from '../dto/list-profiles.dto';
import { ProfilesRepository } from '../profiles.repository';

@Injectable()
export class ListProfilesUsecase {
  constructor(private readonly profilesRepository: ProfilesRepository) {}

  async execute(): Promise<ListProfilesResponseDto> {
    const rows = await this.profilesRepository.listStatuses();
    return {
      profiles: rows.map((row) => ({ repositoryId: row.repositoryId, status: row.status, builtAt: row.builtAt?.toISOString() ?? null })),
    };
  }
}
