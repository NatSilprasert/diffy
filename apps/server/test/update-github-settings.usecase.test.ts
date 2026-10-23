import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ getAuthenticatedLogin: vi.fn() }));

import { getAuthenticatedLogin } from '@diffy/core';
import type { CryptoService } from '../src/infra/crypto/crypto.service';
import { UpdateGithubSettingsRequestSchema } from '../src/module/settings/dto/update-github-settings.dto';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { UpdateGithubSettingsUsecase } from '../src/module/settings/usecase/update-github-settings.usecase';

const upsertGithub = vi.fn();
const usecase = new UpdateGithubSettingsUsecase(
  { upsertGithub } as unknown as SettingsRepository,
  { encrypt: (plain: string) => `enc(${plain.length})` } as unknown as CryptoService,
);

beforeEach(() => {
  upsertGithub.mockReset();
  vi.mocked(getAuthenticatedLogin).mockReset();
});

describe('UpdateGithubSettingsUsecase', () => {
  it('verifies the token, stores only the encrypted value and returns the login', async () => {
    vi.mocked(getAuthenticatedLogin).mockResolvedValue('octocat');

    const result = await usecase.execute({ token: 'github_pat_secret' });

    expect(result).toEqual({ login: 'octocat' });
    expect(getAuthenticatedLogin).toHaveBeenCalledWith('github_pat_secret');
    expect(upsertGithub).toHaveBeenCalledWith({ githubTokenEnc: 'enc(17)', githubLogin: 'octocat' });
    expect(JSON.stringify(upsertGithub.mock.calls)).not.toContain('github_pat_secret');
  });

  it.each([401, 403])('turns a GitHub %i into a 400 and saves nothing', async (status) => {
    vi.mocked(getAuthenticatedLogin).mockRejectedValue(Object.assign(new Error('Bad credentials'), { status }));
    await expect(usecase.execute({ token: 'bad' })).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertGithub).not.toHaveBeenCalled();
  });

  it('turns a network or server failure into a 502 and saves nothing', async () => {
    vi.mocked(getAuthenticatedLogin).mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.github.com'));
    await expect(usecase.execute({ token: 'x' })).rejects.toBeInstanceOf(BadGatewayException);
    expect(upsertGithub).not.toHaveBeenCalled();
  });
});

describe('UpdateGithubSettingsRequestSchema', () => {
  it('trims whitespace around the token', () => {
    expect(UpdateGithubSettingsRequestSchema.parse({ token: '  ghp_abc\n' })).toEqual({ token: 'ghp_abc' });
  });

  it.each([{}, { token: '' }, { token: '   ' }, { token: 123 }])('rejects %j', (body) => {
    expect(UpdateGithubSettingsRequestSchema.safeParse(body).success).toBe(false);
  });
});
