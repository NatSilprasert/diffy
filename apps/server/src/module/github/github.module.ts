import { Module } from '@nestjs/common';
import { GithubRepository } from './github.repository';
import { GithubService } from './github.service';

@Module({
  providers: [GithubRepository, GithubService],
  // Only the service is public: other modules get a GitHub client (and the installations) from it and never see
  // how they are made.
  exports: [GithubService],
})
export class GithubModule {}
