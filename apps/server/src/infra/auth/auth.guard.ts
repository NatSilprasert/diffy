import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../decorator/public.decorator';
import { type HttpRequest, parseCookies } from '../http/cookies';
import { AUTHENTICATOR, type Authenticator } from './authenticator';
import { SESSION_COOKIE } from './session-cookie';

// Every route needs a signed-in person unless it says @Public(). Registered once for the whole app (AppModule).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHENTICATOR) private readonly authenticator: Authenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const auth = await this.authenticator.authenticate(parseCookies(request.headers.cookie)[SESSION_COOKIE]);
    if (!auth) throw new UnauthorizedException('Sign in with GitHub first.');
    request.auth = auth;
    return true;
  }
}
