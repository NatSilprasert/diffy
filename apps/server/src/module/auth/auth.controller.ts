import { Body, Controller, Get, HttpCode, Post, Put, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiForbiddenResponse, ApiNoContentResponse, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { Public } from '../../infra/decorator/public.decorator';
import { SESSION_COOKIE } from '../../infra/auth/session-cookie';
import { type HttpRequest, type HttpResponse, parseCookies } from '../../infra/http/cookies';
import { AuthService } from './auth.service';
import { CompleteLoginQuerySchema } from './dto/complete-login.dto';
import { GetMeResponseDto } from './dto/get-me.dto';
import { SwitchAccountRequestDto, SwitchAccountResponseDto } from './dto/switch-account.dto';
import { CompleteLoginUsecase } from './usecase/complete-login.usecase';
import { GetMeUsecase } from './usecase/get-me.usecase';
import { LogoutUsecase } from './usecase/logout.usecase';
import { StartLoginUsecase } from './usecase/start-login.usecase';
import { SwitchAccountUsecase } from './usecase/switch-account.usecase';

export const STATE_COOKIE = 'diffy_oauth_state';
const STATE_MINUTES = 10;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly startLoginUsecase: StartLoginUsecase,
    private readonly completeLoginUsecase: CompleteLoginUsecase,
    private readonly getMeUsecase: GetMeUsecase,
    private readonly switchAccountUsecase: SwitchAccountUsecase,
    private readonly logoutUsecase: LogoutUsecase,
  ) {}

  // The browser is sent to GitHub; these two are redirects, not API calls, so they are not in the OpenAPI spec.
  @Public()
  @Get('github/login')
  @ApiExcludeEndpoint()
  login(@Query('prompt') prompt: string | undefined, @Res() res: HttpResponse) {
    const { url, state } = this.startLoginUsecase.execute({ selectAccount: prompt === 'select_account' });
    res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: this.authService.secureCookies, sameSite: 'lax', maxAge: STATE_MINUTES * 60_000, path: '/api/auth' });
    res.redirect(url);
  }

  @Public()
  @Get('github/callback')
  @ApiExcludeEndpoint()
  async callback(@Query() query: Record<string, unknown>, @Req() req: HttpRequest, @Res() res: HttpResponse) {
    const parsed = CompleteLoginQuerySchema.safeParse(query);
    // The person said no on GitHub, or the address was made up: back to the web app, which shows the sign-in again.
    if (!parsed.success) return res.redirect(`${this.authService.webUrl}/`);

    const state = parseCookies(req.headers.cookie)[STATE_COOKIE];
    const { token, expiresAt } = await this.completeLoginUsecase.execute(parsed.data, state);

    res.clearCookie(STATE_COOKIE, { path: '/api/auth' });
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: this.authService.secureCookies, sameSite: 'lax', maxAge: expiresAt.getTime() - Date.now(), path: '/' });
    res.redirect(`${this.authService.webUrl}/`);
  }

  @Get('me')
  @ZodSerializerDto(GetMeResponseDto)
  @ApiOkResponse({ type: GetMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Not signed in' })
  getMe(@Req() req: HttpRequest) {
    return this.getMeUsecase.execute(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
  }

  @Put('account')
  @ZodSerializerDto(SwitchAccountResponseDto)
  @ApiOkResponse({ type: SwitchAccountResponseDto })
  @ApiForbiddenResponse({ description: 'The person cannot use diffy for that account' })
  switchAccount(@Req() req: HttpRequest, @Body() body: SwitchAccountRequestDto) {
    return this.switchAccountUsecase.execute(parseCookies(req.headers.cookie)[SESSION_COOKIE], body);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Signed out' })
  async logout(@Req() req: HttpRequest, @Res({ passthrough: true }) res: HttpResponse) {
    await this.logoutUsecase.execute(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
