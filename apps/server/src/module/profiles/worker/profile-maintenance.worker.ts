import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import { ProfilesService } from '../profiles.service';

// How often the project briefs are looked after. Cheap: the database, and GitHub only for a brief that is a day old.
export const MAINTAIN_EVERY_MS = 10 * 60 * 1000;

// Looks after the project briefs on a timer: starts one for a watched repository that has none (its account may have
// set up its model only now), and builds again one whose project changed a lot. Pull requests are not its business:
// GitHub tells diffy about those through webhooks. Like the other workers it keeps its state in memory, so it works
// with one server instance.
@Injectable()
export class ProfileMaintenanceWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProfileMaintenanceWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly reposService: ReposService,
    private readonly profilesService: ProfilesService,
  ) {}

  onApplicationBootstrap(): void {
    void this.run();
    this.timer = setInterval(() => void this.run(), MAINTAIN_EVERY_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  // One pass. Never throws, and a pass that is still running when the timer fires again is not started twice.
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const repos = await this.reposService.listWatchedRepos();
      await this.profilesService.startMissing(repos);
      await this.profilesService.refreshStale(repos);
    } catch (err) {
      this.logger.error(`Could not look after the project briefs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
