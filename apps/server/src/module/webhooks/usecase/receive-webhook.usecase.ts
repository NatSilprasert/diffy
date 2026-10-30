import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { ENV } from '../../../infra/config/config.module';
import type { Env } from '../../../infra/config/env';
import { verifyWebhookSignature } from '../../../infra/github/webhook-signature';
import { GithubService } from '../../github/github.service';
import { ReposService } from '../../repos/repos.service';
import { ReviewsService } from '../../reviews/reviews.service';
import type { ReceiveWebhookResponseDto } from '../dto/receive-webhook.dto';

const InstallationPayload = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number().int(),
    // Null for a few odd cases (a deleted account); such an installation is not worth keeping.
    account: z.object({ login: z.string(), type: z.string() }).nullable(),
    repository_selection: z.enum(['all', 'selected']),
  }),
});

const PullRequestPayload = z.object({
  action: z.string(),
  repository: z.object({ name: z.string(), owner: z.object({ login: z.string() }) }),
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    html_url: z.string(),
    draft: z.boolean().optional(),
    head: z.object({ sha: z.string() }),
    // Null when the author's account was deleted.
    user: z.object({ type: z.string() }).nullable(),
  }),
});

// What happens to a pull request is decided by these: a new one, new commits, a closed one that comes back, a draft
// that is ready now. Everything else (labels, assignees, closing, edits of the text) needs no review.
const REVIEW_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);

export type ReceiveWebhookInput = {
  event: string | undefined;
  signature: string | undefined;
  rawBody: Buffer | undefined;
  payload: unknown;
};

// One endpoint receives everything GitHub sends the App. It trusts nothing until the signature checks out.
@Injectable()
export class ReceiveWebhookUsecase {
  private readonly logger = new Logger(ReceiveWebhookUsecase.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly reposService: ReposService,
    private readonly reviewsService: ReviewsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async execute(input: ReceiveWebhookInput): Promise<ReceiveWebhookResponseDto> {
    if (!verifyWebhookSignature(input.rawBody, input.signature, this.env.GITHUB_WEBHOOK_SECRET)) throw new UnauthorizedException('Bad webhook signature.');

    const event = input.event ?? '';
    switch (event) {
      case 'ping':
        return { handled: true, event };
      case 'installation':
      case 'installation_repositories':
        await this.onInstallation(event, input.payload);
        return { handled: true, event };
      case 'pull_request':
        await this.onPullRequest(input.payload);
        return { handled: true, event };
      default:
        return { handled: false, event };
    }
  }

  private async onPullRequest(payload: unknown): Promise<void> {
    const parsed = PullRequestPayload.safeParse(payload);
    if (!parsed.success) throw new BadRequestException('Unexpected pull_request payload.');
    const { action, repository, pull_request: pr } = parsed.data;
    if (!REVIEW_ACTIONS.has(action)) return;

    // A repository nobody asked diffy to watch (the App may be installed on all of an account's repositories).
    const repo = await this.reposService.findPollableRepo(repository.owner.login, repository.name);
    if (!repo) return;

    const queued = await this.reviewsService.queueReview(repo, {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      headSha: pr.head.sha,
      isDraft: pr.draft ?? false,
      authorIsBot: pr.user?.type === 'Bot',
    });
    if (queued) this.logger.log(`${repo.owner}/${repo.name}#${pr.number}: queued a review (${action})`);
  }

  private async onInstallation(event: string, payload: unknown): Promise<void> {
    const parsed = InstallationPayload.safeParse(payload);
    if (!parsed.success) throw new BadRequestException(`Unexpected ${event} payload.`);
    const { action, installation } = parsed.data;
    if (!installation.account) return;

    const data = {
      installationId: installation.id,
      accountLogin: installation.account.login,
      accountType: installation.account.type,
      repositorySelection: installation.repository_selection,
    };

    if (event === 'installation_repositories') {
      // Repositories were added or taken away. GitHub keeps the list, so only the selection is recorded.
      await this.githubService.recordInstallation(data);
      return;
    }

    switch (action) {
      case 'created':
      case 'new_permissions_accepted':
        await this.githubService.recordInstallation(data);
        break;
      case 'deleted':
        await this.githubService.markInstallation(data.installationId, { removedAt: new Date() });
        break;
      case 'suspend':
        await this.githubService.markInstallation(data.installationId, { suspendedAt: new Date() });
        break;
      case 'unsuspend':
        await this.githubService.markInstallation(data.installationId, { suspendedAt: null });
        break;
      default:
        this.logger.warn(`Ignored installation action "${action}"`);
    }
  }
}
