import { createHmac } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/infra/config/env';
import type { GithubService } from '../src/module/github/github.service';
import type { ReposService } from '../src/module/repos/repos.service';
import type { ReviewsService } from '../src/module/reviews/reviews.service';
import { ReceiveWebhookUsecase } from '../src/module/webhooks/usecase/receive-webhook.usecase';

const secret = 'a-long-enough-webhook-secret';
const recordInstallation = vi.fn();
const markInstallation = vi.fn();
const findPollableRepo = vi.fn();
const queueReview = vi.fn();

const usecase = (env: Partial<Env> = { GITHUB_WEBHOOK_SECRET: secret }) =>
  new ReceiveWebhookUsecase(
    { recordInstallation, markInstallation } as unknown as GithubService,
    { findPollableRepo } as unknown as ReposService,
    { queueReview } as unknown as ReviewsService,
    env as Env,
  );

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
  for (const fn of [recordInstallation, markInstallation, findPollableRepo, queueReview]) fn.mockReset();
  findPollableRepo.mockResolvedValue({ id: 'r1', owner: 'NatSilprasert', name: 'diffy-sandbox', baselineShas: [] });
  queueReview.mockResolvedValue(true);
});

describe('ReceiveWebhookUsecase', () => {
  it('answers 503 when the App is not configured, and 401 for a bad signature, touching nothing', async () => {
    await expect(usecase({}).execute(delivery('ping', {}))).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(usecase().execute(delivery('installation', { action: 'created', installation: installation() }, { signature: 'sha256=00' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(recordInstallation).not.toHaveBeenCalled();
  });

  it('answers a ping', async () => {
    expect(await usecase().execute(delivery('ping', { zen: 'x' }))).toEqual({ handled: true, event: 'ping' });
  });

  it('records a new installation', async () => {
    const result = await usecase().execute(delivery('installation', { action: 'created', installation: installation() }));

    expect(result).toEqual({ handled: true, event: 'installation' });
    expect(recordInstallation).toHaveBeenCalledWith({ installationId: 176119160, accountLogin: 'NatSilprasert', accountType: 'User', repositorySelection: 'selected' });
  });

  it.each([
    ['deleted', { removedAt: expect.any(Date) }],
    ['suspend', { suspendedAt: expect.any(Date) }],
    ['unsuspend', { suspendedAt: null }],
  ])('marks the installation on "%s"', async (action, data) => {
    await usecase().execute(delivery('installation', { action, installation: installation() }));
    expect(markInstallation).toHaveBeenCalledWith(176119160, data);
    expect(recordInstallation).not.toHaveBeenCalled();
  });

  it('keeps the selection up to date when repositories are added or removed', async () => {
    await usecase().execute(delivery('installation_repositories', { action: 'added', installation: installation({ repository_selection: 'all' }) }));
    expect(recordInstallation).toHaveBeenCalledWith(expect.objectContaining({ repositorySelection: 'all' }));
  });

  it('refuses an installation payload it cannot read, and ignores an unknown action', async () => {
    await expect(usecase().execute(delivery('installation', { action: 'created' }))).rejects.toBeInstanceOf(BadRequestException);
    await usecase().execute(delivery('installation', { action: 'something_new', installation: installation() }));
    expect(recordInstallation).not.toHaveBeenCalled();
    expect(markInstallation).not.toHaveBeenCalled();
  });

  it('says an event it has no use for was not handled', async () => {
    expect(await usecase().execute(delivery('star', { action: 'created' }))).toEqual({ handled: false, event: 'star' });
  });
});

describe('ReceiveWebhookUsecase pull requests', () => {
  const pullRequest = (over: Record<string, unknown> = {}) => ({
    action: 'opened',
    repository: { name: 'diffy-sandbox', owner: { login: 'NatSilprasert' } },
    pull_request: {
      number: 4,
      title: 'Add search',
      html_url: 'https://github.com/NatSilprasert/diffy-sandbox/pull/4',
      draft: false,
      head: { sha: 'abc1234' },
      user: { type: 'User' },
    },
    ...over,
  });

  it('queues a review for a pull request of a watched repository', async () => {
    expect(await usecase().execute(delivery('pull_request', pullRequest()))).toEqual({ handled: true, event: 'pull_request' });

    expect(findPollableRepo).toHaveBeenCalledWith('NatSilprasert', 'diffy-sandbox');
    expect(queueReview).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), {
      number: 4,
      title: 'Add search',
      url: 'https://github.com/NatSilprasert/diffy-sandbox/pull/4',
      headSha: 'abc1234',
      isDraft: false,
      authorIsBot: false,
    });
  });

  it.each(['opened', 'synchronize', 'reopened', 'ready_for_review'])('reviews on "%s"', async (action) => {
    await usecase().execute(delivery('pull_request', pullRequest({ action })));
    expect(queueReview).toHaveBeenCalledTimes(1);
  });

  it.each(['closed', 'edited', 'labeled', 'assigned', 'converted_to_draft'])('does nothing on "%s"', async (action) => {
    await usecase().execute(delivery('pull_request', pullRequest({ action })));
    expect(findPollableRepo).not.toHaveBeenCalled();
    expect(queueReview).not.toHaveBeenCalled();
  });

  it('tells a draft and a bot author to the reviews service, which decides', async () => {
    const draft = pullRequest();
    (draft.pull_request as Record<string, unknown>).draft = true;
    (draft.pull_request as Record<string, unknown>).user = { type: 'Bot' };
    await usecase().execute(delivery('pull_request', draft));
    expect(queueReview.mock.calls[0]![1]).toMatchObject({ isDraft: true, authorIsBot: true });
  });

  it('does not queue anything for a repository that is not watched', async () => {
    findPollableRepo.mockResolvedValue(null);
    expect(await usecase().execute(delivery('pull_request', pullRequest()))).toEqual({ handled: true, event: 'pull_request' });
    expect(queueReview).not.toHaveBeenCalled();
  });

  it('takes a pull request whose author was deleted', async () => {
    const orphan = pullRequest();
    (orphan.pull_request as Record<string, unknown>).user = null;
    await usecase().execute(delivery('pull_request', orphan));
    expect(queueReview.mock.calls[0]![1]).toMatchObject({ authorIsBot: false });
  });

  it('refuses a payload it cannot read, and queues nothing for a bad signature', async () => {
    await expect(usecase().execute(delivery('pull_request', { action: 'opened' }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(usecase().execute(delivery('pull_request', pullRequest(), { signature: 'sha256=00' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(queueReview).not.toHaveBeenCalled();
  });
});
