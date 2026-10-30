import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/infra/auth/auth.guard';
import type { Authenticator } from '../src/infra/auth/authenticator';

const run = async (over: { isPublic?: boolean; cookie?: string; auth?: unknown } = {}) => {
  const request: { headers: { cookie?: string }; auth?: unknown } = { headers: { cookie: over.cookie } };
  const authenticate = vi.fn().mockResolvedValue(over.auth ?? null);
  const guard = new AuthGuard({ getAllAndOverride: () => over.isPublic ?? false } as unknown as Reflector, { authenticate } as unknown as Authenticator);
  const context = { getHandler: () => 'h', getClass: () => 'c', switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { result: guard.canActivate(context), request, authenticate };
};

describe('AuthGuard', () => {
  it('lets a public route through without looking at anything', async () => {
    const { result, authenticate } = await run({ isPublic: true });
    expect(await result).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('lets a signed-in person through and tells the route who they are', async () => {
    const auth = { sessionId: 's1', userId: 'u1', accountId: 'a1' };
    const { result, request, authenticate } = await run({ cookie: 'x=1; diffy_session=tok; y=2', auth });
    expect(await result).toBe(true);
    expect(authenticate).toHaveBeenCalledWith('tok');
    expect(request.auth).toEqual(auth);
  });

  it('answers 401 with no cookie, or a cookie that is not a live session', async () => {
    await expect((await run({})).result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect((await run({ cookie: 'diffy_session=old' })).result).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
