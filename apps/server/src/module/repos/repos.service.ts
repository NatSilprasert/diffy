import { Injectable, NotFoundException } from '@nestjs/common';
import { ReposRepository } from './repos.repository';

// The repos module's public API for other modules (reviews now, the poller later).
@Injectable()
export class ReposService {
  constructor(private readonly reposRepository: ReposRepository) {}

  // A repository the user is watching. Unknown and removed ids are both "not found".
  async getActiveRepo(id: string): Promise<{ id: string; owner: string; name: string }> {
    const repo = await this.reposRepository.findActiveById(id);
    if (!repo) throw new NotFoundException('Repository not found.');
    return { id: repo.id, owner: repo.owner, name: repo.name };
  }
}
