import { describe, expect, it, vi } from 'vitest';

const authenticated = vi.fn();
const listForUser = Symbol('listInstallationsForAuthenticatedUser');
const paginate = vi.fn();
vi.mock('octokit', () => ({
  Octokit: class {
    constructor(readonly options: unknown) {}
    rest = { users: { getAuthenticated: authenticated }, apps: { listInstallationsForAuthenticatedUser: listForUser } };
    paginate = paginate;
  },
}));

import { buildAuthorizeUrl, exchangeCodeForToken, getSignedInUser, listUserAccounts } from '../src/github-oauth.js';

describe('buildAuthorizeUrl', () => {
  it('sends the person to GitHub with the state to check on the way back', () => {
    const url = new URL(buildAuthorizeUrl({ clientId: 'Iv1.abc', redirectUri: 'http://localhost:4000/api/auth/github/callback', state: 's t' }));
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: 'Iv1.abc', redirect_uri: 'http://localhost:4000/api/auth/github/callback', state: 's t' });
  });
});

describe('exchangeCodeForToken', () => {
  const input = { clientId: 'id', clientSecret: 'secret', code: 'the-code', redirectUri: 'http://x/cb' };
  const answer = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body });

  it('trades the code for a token', async () => {
    const fetchImpl = answer({ access_token: 'ghu_token' });
    expect(await exchangeCodeForToken(input, fetchImpl)).toBe('ghu_token');

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(init.headers.accept).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ client_id: 'id', client_secret: 'secret', code: 'the-code', redirect_uri: 'http://x/cb' });
  });

  it('explains a refusal, which GitHub sends with a 200', async () => {
    await expect(exchangeCodeForToken(input, answer({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }))).rejects.toThrow(
      'GitHub did not accept the sign-in: The code passed is incorrect or expired.',
    );
    await expect(exchangeCodeForToken(input, answer({ error: 'bad_verification_code' }))).rejects.toThrow('GitHub did not accept the sign-in: bad_verification_code');
    await expect(exchangeCodeForToken(input, answer({}, false))).rejects.toThrow('GitHub did not accept the sign-in');
  });

  it('does not echo the secret in an error', async () => {
    const error = await exchangeCodeForToken(input, answer({ error: 'x' })).catch((err) => err);
    expect(error.message).not.toContain('secret');
  });
});

describe('getSignedInUser', () => {
  it('reads who the token speaks for', async () => {
    authenticated.mockResolvedValue({ data: { id: 198521346, login: 'NatSilprasert', name: 'Nat', avatar_url: 'https://avatars/x.png' } });
    expect(await getSignedInUser('ghu_token')).toEqual({ githubId: 198521346, login: 'NatSilprasert', name: 'Nat', avatarUrl: 'https://avatars/x.png' });
  });

  it('copes with a person who has no public name', async () => {
    authenticated.mockResolvedValue({ data: { id: 1, login: 'a', name: null, avatar_url: '' } });
    expect(await getSignedInUser('t')).toMatchObject({ name: null, avatarUrl: null });
  });
});

describe('listUserAccounts', () => {
  it('lists each account once, whatever its kind, and skips an installation without one', async () => {
    paginate.mockResolvedValue([
      { account: { id: 1, login: 'NatSilprasert', type: 'User' } },
      { account: { id: 2, login: 'acme', type: 'Organization' } },
      { account: { id: 1, login: 'NatSilprasert', type: 'User' } },
      { account: { id: 3, slug: 'big-corp', type: 'Enterprise' } },
      { account: null },
    ]);
    expect(await listUserAccounts('t')).toEqual([
      { githubId: 1, login: 'NatSilprasert', type: 'User' },
      { githubId: 2, login: 'acme', type: 'Organization' },
      { githubId: 3, login: 'big-corp', type: 'Enterprise' },
    ]);
    expect(paginate).toHaveBeenCalledWith(listForUser, { per_page: 100 });
  });
});
