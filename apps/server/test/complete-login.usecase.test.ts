import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ exchangeCodeForToken: vi.fn(), getSignedInUser: vi.fn(), listUserAccounts: vi.fn() }));

import { exchangeCodeForToken, getSignedInUser, listUserAccounts } from '@diffy/core';
import type { Env } from '../src/infra/config/env';
import { hashSessionToken } from '../src/infra/security/session-token';
import type { AccountsService } from '../src/module/accounts/accounts.service';
import type { AuthRepository } from '../src/module/auth/auth.repository';
import type { AuthService } from '../src/module/auth/auth.service';
import { CompleteLoginUsecase } from '../src/module/auth/usecase/complete-login.usecase';

const upsertUser = vi.fn();
const replaceMemberships = vi.fn();
const createSession = vi.fn();
const recordAccount = vi.fn();
const env = { GITHUB_CLIENT_ID: 'Iv23liabc', GITHUB_CLIENT_SECRET: 'client-secret' } as Env;
const usecase = new CompleteLoginUsecase(
  { upsertUser, replaceMemberships, createSession } as unknown as AuthRepository,
  { recordAccount } as unknown as AccountsService,
  { callbackUrl: 'http://localhost:4000/api/auth/github/callback' } as unknown as AuthService,
  env,
);

const query = { code: 'the-code', state: 'the-state' };
const now = new Date('2026-10-30T12:00:00Z');

beforeEach(() => {
  for (const fn of [upsertUser, replaceMemberships, createSession, recordAccount, vi.mocked(exchangeCodeForToken), vi.mocked(getSignedInUser), vi.mocked(listUserAccounts)]) fn.mockReset();
  vi.mocked(exchangeCodeForToken).mockResolvedValue('ghu_usertoken');
  vi.mocked(getSignedInUser).mockResolvedValue({ githubId: 198521346, login: 'NatSilprasert', name: 'Nat', avatarUrl: 'https://a/x.png' });
  vi.mocked(listUserAccounts).mockResolvedValue([
    { githubId: 1, login: 'NatSilprasert', type: 'User' },
    { githubId: 2, login: 'acme', type: 'Organization' },
  ]);
  upsertUser.mockResolvedValue({ id: 'u1' });
  recordAccount.mockImplementation(async (a: { githubId: number }) => ({ id: `acc${a.githubId}`, ...a }));
  createSession.mockResolvedValue(undefined);
  replaceMemberships.mockResolvedValue(undefined);
});

describe('CompleteLoginUsecase', () => {
  it('signs the person in: their record, their accounts, and a session for thirty days', async () => {
    const result = await usecase.execute(query, 'the-state', now);

    expect(vi.mocked(exchangeCodeForToken)).toHaveBeenCalledWith({
      clientId: 'Iv23liabc',
      clientSecret: 'client-secret',
      code: 'the-code',
      redirectUri: 'http://localhost:4000/api/auth/github/callback',
    });
    expect(upsertUser).toHaveBeenCalledWith({ githubId: 198521346, login: 'NatSilprasert', name: 'Nat', avatarUrl: 'https://a/x.png' });
    expect(recordAccount).toHaveBeenCalledTimes(2);
    expect(replaceMemberships).toHaveBeenCalledWith('u1', ['acc1', 'acc2']);
    expect(result.expiresAt).toEqual(new Date('2026-11-29T12:00:00Z'));
  });

  it('keeps only the hash of the session token, and gives the token itself to the browser', async () => {
    const { token } = await usecase.execute(query, 'the-state', now);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(createSession).toHaveBeenCalledWith({ tokenHash: hashSessionToken(token), userId: 'u1', expiresAt: new Date('2026-11-29T12:00:00Z') });
    expect(JSON.stringify(createSession.mock.calls)).not.toContain(token);
  });

  it('does not keep the GitHub token of the person anywhere', async () => {
    await usecase.execute(query, 'the-state', now);
    expect(JSON.stringify([upsertUser.mock.calls, replaceMemberships.mock.calls, createSession.mock.calls, recordAccount.mock.calls])).not.toContain('ghu_usertoken');
  });

  it.each([
    ['the state does not match', 'other-state'],
    ['there is no state in the browser', undefined],
  ])('answers 401 and does nothing when %s', async (_name, expected) => {
    await expect(usecase.execute(query, expected, now)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(exchangeCodeForToken).not.toHaveBeenCalled();
    expect(upsertUser).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('answers 502 with the reason when GitHub refuses the code, and signs nobody in', async () => {
    vi.mocked(exchangeCodeForToken).mockRejectedValue(new Error('GitHub did not accept the sign-in: The code passed is incorrect or expired.'));
    const error = await usecase.execute(query, 'the-state', now).catch((err) => err);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toMatch(/incorrect or expired/);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('can sign in a person who can reach no account yet', async () => {
    vi.mocked(listUserAccounts).mockResolvedValue([]);
    await usecase.execute(query, 'the-state', now);
    expect(replaceMemberships).toHaveBeenCalledWith('u1', []);
    expect(createSession).toHaveBeenCalled();
  });
});
