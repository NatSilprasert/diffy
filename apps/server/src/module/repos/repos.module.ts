import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { SettingsModule } from '../settings/settings.module';
import { ReposController } from './repos.controller';
import { ReposRepository } from './repos.repository';
import { ReposService } from './repos.service';
import { AddRepoUsecase } from './usecase/add-repo.usecase';
import { ListAvailableReposUsecase } from './usecase/list-available-repos.usecase';
import { ListReposUsecase } from './usecase/list-repos.usecase';
import { RemoveRepoUsecase } from './usecase/remove-repo.usecase';
import { UpdateRepoUsecase } from './usecase/update-repo.usecase';

@Module({
  imports: [SettingsModule, GithubModule],
  controllers: [ReposController],
  providers: [
    ReposRepository,
    ReposService,
    ListAvailableReposUsecase,
    ListReposUsecase,
    AddRepoUsecase,
    UpdateRepoUsecase,
    RemoveRepoUsecase,
  ],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [ReposService],
})
export class ReposModule {}
