import { Octokit } from 'octokit';

// Signing people in with GitHub: the "user-to-server" side of the diffy GitHub App. A person is sent to GitHub, agrees,
// and comes back with a one-time code. diffy trades the code for a token that speaks for that person, asks GitHub who
// they are and where they can use diffy, and then throws the token away: nothing here is kept.

// `selectAccount` makes GitHub show its account picker even when the browser is signed in to GitHub already, for a
// person who has more than one GitHub account.
export function buildAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  selectAccount = false,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  selectAccount?: boolean;
}): string {
  const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state });
  if (selectAccount) query.set('prompt', 'select_account');
  return `https://github.com/login/oauth/authorize?${query}`;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

// GitHub answers 200 even when it refuses (bad or used code): the reason is in the body.
export async function exchangeCodeForToken(
  input: { clientId: string; clientSecret: string; code: string; redirectUri: string },
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<string> {
  const response = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: input.clientId, client_secret: input.clientSecret, code: input.code, redirect_uri: input.redirectUri }),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`GitHub did not accept the sign-in${body.error_description ? `: ${body.error_description}` : body.error ? `: ${body.error}` : ''}`);
  }
  return body.access_token;
}

export type SignedInUser = { githubId: number; login: string; name: string | null; avatarUrl: string | null };

export async function getSignedInUser(token: string): Promise<SignedInUser> {
  const { data } = await new Octokit({ auth: token }).rest.users.getAuthenticated();
  return { githubId: data.id, login: data.login, name: data.name ?? null, avatarUrl: data.avatar_url || null };
}

export type UserAccount = { githubId: number; login: string; type: string };

// The accounts (people and organizations) where this person can use the diffy App: the ones that installed it and let
// them in.
export async function listUserAccounts(token: string): Promise<UserAccount[]> {
  const octokit = new Octokit({ auth: token });
  const installations = await octokit.paginate(octokit.rest.apps.listInstallationsForAuthenticatedUser, { per_page: 100 });
  const accounts = new Map<number, UserAccount>();
  for (const installation of installations) {
    const account = installation.account as { id?: number; login?: string; slug?: string; type?: string } | null;
    if (!account?.id) continue;
    accounts.set(account.id, { githubId: account.id, login: account.login ?? account.slug ?? '', type: account.type ?? 'User' });
  }
  return [...accounts.values()];
}
