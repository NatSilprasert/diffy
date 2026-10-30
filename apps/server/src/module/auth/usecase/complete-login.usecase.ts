import { exchangeCodeForToken, getSignedInUser, listUserAccounts } from '@diffy/core';
import { BadGatewayException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ENV } from '../../../infra/config/config.module';
import type { Env } from '../../../infra/config/env';
import { hashSessionToken, newSessionToken, sameState } from '../../../infra/security/session-token';
import { AccountsService } from '../../accounts/accounts.service';
import { AuthRepository } from '../auth.repository';
import { AuthService, SESSION_DAYS } from '../auth.service';
import type { CompleteLoginQuery } from '../dto/complete-login.dto';

export type CompletedLogin = { token: string; expiresAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CompleteLoginUsecase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly accountsService: AccountsService,
    private readonly authService: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // `expectedState` is the one diffy put in the person's browser before sending them to GitHub.
  async execute(query: CompleteLoginQuery, expectedState: string | undefined, now: Date = new Date()): Promise<CompletedLogin> {
    if (!sameState(query.state, expectedState)) {
      throw new UnauthorizedException('This sign-in did not start here. Start again from diffy.');
    }

    // The token GitHub gives speaks for the person; it is used for these two questions and then dropped.
    let user, accounts;
    try {
      const token = await exchangeCodeForToken({
        clientId: this.env.GITHUB_CLIENT_ID,
        clientSecret: this.env.GITHUB_CLIENT_SECRET,
        code: query.code,
        redirectUri: this.authService.callbackUrl,
      });
      [user, accounts] = await Promise.all([getSignedInUser(token), listUserAccounts(token)]);
    } catch (err) {
      throw new BadGatewayException(err instanceof Error ? err.message : 'GitHub did not complete the sign-in.');
    }

    const saved = await this.authRepository.upsertUser(user);
    // Every account they can reach has a row of its own (the webhook may not have told us yet), and is theirs to use.
    const known = await Promise.all(accounts.map((account) => this.accountsService.recordAccount(account)));
    await this.authRepository.replaceMemberships(saved.id, known.map((account) => account.id));

    const token = newSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
    await this.authRepository.createSession({ tokenHash: hashSessionToken(token), userId: saved.id, expiresAt });
    return { token, expiresAt };
  }
}
