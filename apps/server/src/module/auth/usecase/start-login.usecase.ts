import { buildAuthorizeUrl } from '@diffy/core';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../../infra/config/config.module';
import type { Env } from '../../../infra/config/env';
import { newOAuthState } from '../../../infra/security/session-token';
import { AuthService } from '../auth.service';

@Injectable()
export class StartLoginUsecase {
  constructor(
    private readonly authService: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // Where to send the person, and the state that has to come back with them.
  execute(): { url: string; state: string } {
    const state = newOAuthState();
    return { url: buildAuthorizeUrl({ clientId: this.env.GITHUB_CLIENT_ID, redirectUri: this.authService.callbackUrl, state }), state };
  }
}
