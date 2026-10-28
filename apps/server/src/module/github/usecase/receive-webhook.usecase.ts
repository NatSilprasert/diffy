import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { ENV } from '../../../infra/config/config.module';
import type { Env } from '../../../infra/config/env';
import { verifyWebhookSignature } from '../../../infra/github/webhook-signature';
import type { ReceiveWebhookResponseDto } from '../dto/receive-webhook.dto';
import { GithubRepository } from '../github.repository';

const InstallationPayload = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number().int(),
    // Null for a few odd cases (a deleted account); such an installation is not worth keeping.
    account: z.object({ login: z.string(), type: z.string() }).nullable(),
    repository_selection: z.enum(['all', 'selected']),
  }),
});

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
    private readonly githubRepository: GithubRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async execute(input: ReceiveWebhookInput): Promise<ReceiveWebhookResponseDto> {
    const secret = this.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException('The GitHub App is not configured (GITHUB_WEBHOOK_SECRET).');
    if (!verifyWebhookSignature(input.rawBody, input.signature, secret)) throw new UnauthorizedException('Bad webhook signature.');

    const event = input.event ?? '';
    switch (event) {
      case 'ping':
        return { handled: true, event };
      case 'installation':
      case 'installation_repositories':
        await this.onInstallation(event, input.payload);
        return { handled: true, event };
      default:
        return { handled: false, event };
    }
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
      await this.githubRepository.upsertInstallation(data);
      return;
    }

    switch (action) {
      case 'created':
      case 'new_permissions_accepted':
        await this.githubRepository.upsertInstallation(data);
        break;
      case 'deleted':
        await this.githubRepository.updateInstallation(data.installationId, { removedAt: new Date() });
        break;
      case 'suspend':
        await this.githubRepository.updateInstallation(data.installationId, { suspendedAt: new Date() });
        break;
      case 'unsuspend':
        await this.githubRepository.updateInstallation(data.installationId, { suspendedAt: null });
        break;
      default:
        this.logger.warn(`Ignored installation action "${action}"`);
    }
  }
}
