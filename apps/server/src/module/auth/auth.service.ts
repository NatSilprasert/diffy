import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../infra/config/config.module';
import type { Env } from '../../infra/config/env';
import { hashSessionToken } from '../../infra/security/session-token';
import type { AuthContext } from '../../infra/auth/auth-context';
import { AuthRepository } from './auth.repository';
import type { AuthView } from './dto/auth-view.schema';

export const SESSION_DAYS = 30;

// The auth module's public API for other modules (and the guard).
@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Where the browser reaches the API, and where the web app is.
  get publicUrl(): string {
    return (this.env.PUBLIC_URL ?? `http://localhost:${this.env.PORT}`).replace(/\/+$/, '');
  }

  get webUrl(): string {
    return (this.env.WEB_URL ?? this.publicUrl).replace(/\/+$/, '');
  }

  get callbackUrl(): string {
    return `${this.publicUrl}/api/auth/github/callback`;
  }

  // The session cookie is only sent over https when diffy is served over https.
  get secureCookies(): boolean {
    return this.publicUrl.startsWith('https://');
  }

  // The person who installed the App on an account can use diffy for it at once, without signing in again (their
  // accounts are otherwise only read from GitHub when they sign in). Someone who has not signed in yet gets it then.
  grantInstaller(githubUserId: number, accountId: string): Promise<boolean> {
    return this.authRepository.addMembershipByGithubId(githubUserId, accountId);
  }

  // The person behind a session cookie, or null when there is no live session for it.
  async authenticate(token: string | undefined): Promise<AuthContext | null> {
    return (await this.load(token))?.context ?? null;
  }

  // The same, with everything the browser shows about them.
  async describe(token: string | undefined): Promise<(AuthContext & { view: AuthView }) | null> {
    const loaded = await this.load(token);
    return loaded ? { ...loaded.context, view: loaded.view } : null;
  }

  private async load(token: string | undefined): Promise<{ context: AuthContext; view: AuthView } | null> {
    if (!token) return null;
    const session = await this.authRepository.findLiveSession(hashSessionToken(token));
    if (!session) return null;

    const accounts = session.user.memberships.map((membership) => ({ id: membership.account.id, login: membership.account.login, type: membership.account.type }));
    // The account chosen earlier counts only while the person can still reach it.
    const current = accounts.find((account) => account.id === session.accountId) ?? accounts[0] ?? null;

    return {
      context: { sessionId: session.id, userId: session.userId, accountId: current?.id ?? null },
      view: {
        user: { login: session.user.login, name: session.user.name, avatarUrl: session.user.avatarUrl },
        accounts,
        currentAccountId: current?.id ?? null,
      },
    };
  }
}
