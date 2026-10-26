import { Module } from '@nestjs/common';
import { ReposModule } from '../repos/repos.module';
import { SettingsModule } from '../settings/settings.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';
import { GetProfileUsecase } from './usecase/get-profile.usecase';
import { RebuildProfileUsecase } from './usecase/rebuild-profile.usecase';
import { UpdateProfileNotesUsecase } from './usecase/update-profile-notes.usecase';
import { ProfileBuilderService } from './worker/profile-builder.service';

@Module({
  imports: [ReposModule, SettingsModule],
  controllers: [ProfilesController],
  providers: [
    ProfilesRepository,
    ProfileBuilderService,
    ProfilesService,
    GetProfileUsecase,
    UpdateProfileNotesUsecase,
    RebuildProfileUsecase,
  ],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [ProfilesService],
})
export class ProfilesModule {}
