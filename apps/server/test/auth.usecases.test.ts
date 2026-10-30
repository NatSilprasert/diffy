import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/infra/config/env';
import type { AuthRepository } from '../src/module/auth/auth.repository';
import type { AuthService } from '../src/module/auth/auth.service';
import { GetMeUsecase } from '../src/module/auth/usecase/get-me.usecase';
import { LogoutUsecase } from '../src/module/auth/usecase/logout.usecase';
import { StartLoginUsecase } from '../src/module/auth/usecase/start-login.usecase';
import { SwitchAccountUsecase } from '../src/module/auth/usecase/switch-account.usecase';

const view = {
  user: { login: 'nat', name: 'Nat', avatarUrl: null },
  accounts: [{ id: 'a1', login: 'acme', type: 'Organization' }, { id: 'a2', login: 'nat', type: 'User' }],
  currentAccountId: 'a1',
};

describe('StartLoginUsecase', () => {
  it('sends the person to GitHub with the App, the way back and a fresh state', () => {
    const usecase = new StartLoginUsecase({ callbackUrl: 'http://localhost:4000/api/auth/github/callback' } as unknown as AuthService, { GITHUB_CLIENT_ID: 'Iv23liabc' } as Env);
    const first = usecase.execute();
    const url = new URL(first.url);

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('Iv23liabc');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4000/api/auth/github/callback');
    expect(url.searchParams.get('state')).toBe(first.state);
    expect(usecase.execute().state).not.toBe(first.state);
  });
});

describe('GetMeUsecase', () => {
  it('describes the person signed in', async () => {
    const describe_ = vi.fn().mockResolvedValue({ sessionId: 's1', userId: 'u1', accountId: 'a1', view });
    expect(await new GetMeUsecase({ describe: describe_ } as unknown as AuthService).execute('tok')).toEqual(view);
    expect(describe_).toHaveBeenCalledWith('tok');
  });

  it('answers 401 when nobody is signed in', async () => {
    await expect(new GetMeUsecase({ describe: vi.fn().mockResolvedValue(null) } as unknown as AuthService).execute(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('SwitchAccountUsecase', () => {
  const setup = (described: unknown) => {
    const setSessionAccount = vi.fn().mockResolvedValue(undefined);
    const usecase = new SwitchAccountUsecase({ setSessionAccount } as unknown as AuthRepository, { describe: vi.fn().mockResolvedValue(described) } as unknown as AuthService);
    return { usecase, setSessionAccount };
  };

  it('looks at another account the person can reach, and says so', async () => {
    const { usecase, setSessionAccount } = setup({ sessionId: 's1', userId: 'u1', accountId: 'a1', view });
    expect(await usecase.execute('tok', { accountId: 'a2' })).toEqual({ ...view, currentAccountId: 'a2' });
    expect(setSessionAccount).toHaveBeenCalledWith('s1', 'a2');
  });

  it('answers 403 for an account the person cannot reach, changing nothing', async () => {
    const { usecase, setSessionAccount } = setup({ sessionId: 's1', userId: 'u1', accountId: 'a1', view });
    await expect(usecase.execute('tok', { accountId: 'someone-elses' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(setSessionAccount).not.toHaveBeenCalled();
  });

  it('answers 401 when nobody is signed in', async () => {
    const { usecase, setSessionAccount } = setup(null);
    await expect(usecase.execute(undefined, { accountId: 'a1' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(setSessionAccount).not.toHaveBeenCalled();
  });
});

describe('LogoutUsecase', () => {
  it('ends the session of the browser', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    await new LogoutUsecase({ deleteSession } as unknown as AuthRepository, { authenticate: vi.fn().mockResolvedValue({ sessionId: 's1', userId: 'u1', accountId: null }) } as unknown as AuthService).execute('tok');
    expect(deleteSession).toHaveBeenCalledWith('s1');
  });

  it('is fine when there is no session to end', async () => {
    const deleteSession = vi.fn();
    await expect(new LogoutUsecase({ deleteSession } as unknown as AuthRepository, { authenticate: vi.fn().mockResolvedValue(null) } as unknown as AuthService).execute(undefined)).resolves.toBeUndefined();
    expect(deleteSession).not.toHaveBeenCalled();
  });
});
