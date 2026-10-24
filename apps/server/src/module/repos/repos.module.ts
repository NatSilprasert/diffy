import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ReposController } from './repos.controller';
import { ListAvailableReposUsecase } from './usecase/list-available-repos.usecase';

@Module({
  imports: [SettingsModule],
  controllers: [ReposController],
  providers: [ListAvailableReposUsecase],
})
export class ReposModule {}
