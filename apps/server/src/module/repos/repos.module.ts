import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ReposController } from './repos.controller';
import { ReposRepository } from './repos.repository';
import { AddRepoUsecase } from './usecase/add-repo.usecase';
import { ListAvailableReposUsecase } from './usecase/list-available-repos.usecase';
import { ListReposUsecase } from './usecase/list-repos.usecase';

@Module({
  imports: [SettingsModule],
  controllers: [ReposController],
  providers: [ReposRepository, ListAvailableReposUsecase, ListReposUsecase, AddRepoUsecase],
})
export class ReposModule {}
