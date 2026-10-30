import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/infra/config/env';
import { hashSessionToken } from '../src/infra/security/session-token';
import type { AuthRepository } from '../src/module/auth/auth.repository';
import { AuthService } from '../src/module/auth/auth.service';

const account = (id: string, login: string) => ({ account: { id, login, type: 'User' } });
const session = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  userId: 'u1',
  accountId: null,
  user: { login: 'nat', name: 'Nat', avatarUrl: 'https://a/x.png', memberships: [account('a1', 'acme'), account('a2', 'zed')] },
  ...over,
});

const service = (found: unknown, env: Partial<Env> = { PORT: 3000 }) => {
  const findLiveSession = vi.fn().mockResolvedValue(found);
  return { service: new AuthService({ findLiveSession } as unknown as AuthRepository, env as Env), findLiveSession };
};

describe('AuthService addresses', () => {
  it('defaults to localhost on the port, with the web app in the same place', () => {
    const { service: s } = service(null, { PORT: 3000 });
    expect(s.publicUrl).toBe('http://localhost:3000');
    expect(s.webUrl).toBe('http://localhost:3000');
    expect(s.callbackUrl).toBe('http://localhost:3000/api/auth/github/callback');
    expect(s.secureCookies).toBe(false);
  });

  it('uses the configured addresses without a trailing slash, and secure cookies for https', () => {
    const { service: s } = service(null, { PORT: 4000, PUBLIC_URL: 'https://diffy.example.com/', WEB_URL: 'http://localhost:3000/' });
    expect(s.callbackUrl).toBe('https://diffy.example.com/api/auth/github/callback');
    expect(s.webUrl).toBe('http://localhost:3000');
    expect(s.secureCookies).toBe(true);
  });
});

describe('AuthService.authenticate', () => {
  it('looks the session up by the hash of the token, never the token itself', async () => {
    const { service: s, findLiveSession } = service(session());
    await s.authenticate('the-token');
    expect(findLiveSession).toHaveBeenCalledWith(hashSessionToken('the-token'));
    expect(JSON.stringify(findLiveSession.mock.calls)).not.toContain('the-token');
  });

  it('is nobody without a token or without a live session', async () => {
    const none = service(null);
    expect(await none.service.authenticate(undefined)).toBeNull();
    expect(none.findLiveSession).not.toHaveBeenCalled();
    expect(await none.service.authenticate('unknown')).toBeNull();
  });

  it('looks at the first account until the person picks one', async () => {
    expect(await service(session()).service.authenticate('t')).toEqual({ sessionId: 's1', userId: 'u1', accountId: 'a1' });
  });

  it('keeps the account the person picked, while they can still reach it', async () => {
    expect((await service(session({ accountId: 'a2' })).service.authenticate('t'))?.accountId).toBe('a2');
    // lost access: back to the first one they can use
    expect((await service(session({ accountId: 'gone' })).service.authenticate('t'))?.accountId).toBe('a1');
  });

  it('has no account for a person who cannot use diffy anywhere yet', async () => {
    const lonely = session({ user: { login: 'nat', name: null, avatarUrl: null, memberships: [] } });
    expect(await service(lonely).service.authenticate('t')).toEqual({ sessionId: 's1', userId: 'u1', accountId: null });
  });
});

describe('AuthService.describe', () => {
  it('tells the browser who is signed in and where they can look', async () => {
    const described = await service(session({ accountId: 'a2' })).service.describe('t');
    expect(described?.view).toEqual({
      user: { login: 'nat', name: 'Nat', avatarUrl: 'https://a/x.png' },
      accounts: [
        { id: 'a1', login: 'acme', type: 'User' },
        { id: 'a2', login: 'zed', type: 'User' },
      ],
      currentAccountId: 'a2',
    });
  });

  it('is null when nobody is signed in', async () => {
    expect(await service(null).service.describe('t')).toBeNull();
  });
});

describe('AuthService.grantInstaller', () => {
  it('makes the person who installed the App a member of the account', async () => {
    const addMembershipByGithubId = vi.fn().mockResolvedValue(true);
    const s = new AuthService({ addMembershipByGithubId } as unknown as AuthRepository, { PORT: 3000 } as Env);
    expect(await s.grantInstaller(777, 'acc1')).toBe(true);
    expect(addMembershipByGithubId).toHaveBeenCalledWith(777, 'acc1');
  });
});
