import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { ReposModule } from '../repos/repos.module';
import { SettingsModule } from '../settings/settings.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';
import { GetProfileUsecase } from './usecase/get-profile.usecase';
import { ListProfilesUsecase } from './usecase/list-profiles.usecase';
import { RebuildProfileUsecase } from './usecase/rebuild-profile.usecase';
import { UpdateProfileNotesUsecase } from './usecase/update-profile-notes.usecase';
import { ProfileBuilderWorker } from './worker/profile-builder.worker';
import { ProfileFreshnessWorker } from './worker/profile-freshness.worker';

@Module({
  imports: [ReposModule, SettingsModule, GithubModule],
  controllers: [ProfilesController],
  providers: [
    ProfilesRepository,
    ProfileBuilderWorker,
    ProfileFreshnessWorker,
    ProfilesService,
    ListProfilesUsecase,
    GetProfileUsecase,
    UpdateProfileNotesUsecase,
    RebuildProfileUsecase,
  ],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [ProfilesService],
})
export class ProfilesModule {}
