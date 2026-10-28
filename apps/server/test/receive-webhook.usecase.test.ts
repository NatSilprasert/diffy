import { createHmac } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/infra/config/env';
import type { GithubRepository } from '../src/module/github/github.repository';
import { ReceiveWebhookUsecase } from '../src/module/github/usecase/receive-webhook.usecase';

const secret = 'a-long-enough-webhook-secret';
const upsertInstallation = vi.fn();
const updateInstallation = vi.fn();

const usecase = (env: Partial<Env> = { GITHUB_WEBHOOK_SECRET: secret }) =>
  new ReceiveWebhookUsecase({ upsertInstallation, updateInstallation } as unknown as GithubRepository, env as Env);

// A request as GitHub would send it: the payload, its raw bytes and the signature of those bytes.
function delivery(event: string, payload: unknown, over: { signature?: string } = {}) {
  const rawBody = Buffer.from(JSON.stringify(payload));
  return { event, rawBody, payload, signature: over.signature ?? `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}` };
}

const installation = (over: Record<string, unknown> = {}) => ({
  id: 176119160,
  account: { login: 'NatSilprasert', type: 'User' },
  repository_selection: 'selected',
  ...over,
});

beforeEach(() => {
  upsertInstallation.mockReset();
  updateInstallation.mockReset();
});

describe('ReceiveWebhookUsecase', () => {
  it('answers 503 when the App is not configured, and 401 for a bad signature, touching nothing', async () => {
    await expect(usecase({}).execute(delivery('ping', {}))).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(usecase().execute(delivery('installation', { action: 'created', installation: installation() }, { signature: 'sha256=00' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(upsertInstallation).not.toHaveBeenCalled();
  });

  it('answers a ping', async () => {
    expect(await usecase().execute(delivery('ping', { zen: 'x' }))).toEqual({ handled: true, event: 'ping' });
  });

  it('records a new installation', async () => {
    const result = await usecase().execute(delivery('installation', { action: 'created', installation: installation() }));

    expect(result).toEqual({ handled: true, event: 'installation' });
    expect(upsertInstallation).toHaveBeenCalledWith({ installationId: 176119160, accountLogin: 'NatSilprasert', accountType: 'User', repositorySelection: 'selected' });
  });

  it.each([
    ['deleted', { removedAt: expect.any(Date) }],
    ['suspend', { suspendedAt: expect.any(Date) }],
    ['unsuspend', { suspendedAt: null }],
  ])('marks the installation on "%s"', async (action, data) => {
    await usecase().execute(delivery('installation', { action, installation: installation() }));
    expect(updateInstallation).toHaveBeenCalledWith(176119160, data);
    expect(upsertInstallation).not.toHaveBeenCalled();
  });

  it('keeps the selection up to date when repositories are added or removed', async () => {
    await usecase().execute(delivery('installation_repositories', { action: 'added', installation: installation({ repository_selection: 'all' }) }));
    expect(upsertInstallation).toHaveBeenCalledWith(expect.objectContaining({ repositorySelection: 'all' }));
  });

  it('refuses an installation payload it cannot read, and ignores an unknown action', async () => {
    await expect(usecase().execute(delivery('installation', { action: 'created' }))).rejects.toBeInstanceOf(BadRequestException);
    await usecase().execute(delivery('installation', { action: 'something_new', installation: installation() }));
    expect(upsertInstallation).not.toHaveBeenCalled();
    expect(updateInstallation).not.toHaveBeenCalled();
  });

  it('says an event it has no use for was not handled', async () => {
    expect(await usecase().execute(delivery('star', { action: 'created' }))).toEqual({ handled: false, event: 'star' });
  });
});
