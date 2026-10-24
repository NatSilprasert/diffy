import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CryptoService } from '../src/infra/crypto/crypto.service';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { SettingsService } from '../src/module/settings/settings.service';

const service = (row: { githubTokenEnc: string | null } | null, decrypt: (v: string) => string) =>
  new SettingsService(
    { findSingleton: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository,
    { decrypt } as unknown as CryptoService,
  );

describe('SettingsService.getGithubToken', () => {
  it('returns the decrypted token', async () => {
    expect(await service({ githubTokenEnc: 'v1:x' }, (v) => `plain(${v})`).getGithubToken()).toBe('plain(v1:x)');
  });

  it.each([['no row', null], ['no token', { githubTokenEnc: null }]])('asks the user to connect GitHub (%s)', async (_n, row) => {
    await expect(service(row, () => 'x').getGithubToken()).rejects.toThrow('Connect your GitHub token in Settings first.');
  });

  it('explains an undecryptable token as a 400', async () => {
    const broken = service({ githubTokenEnc: 'v1:x' }, () => {
      throw new Error('Cannot decrypt value');
    });
    await expect(broken.getGithubToken()).rejects.toBeInstanceOf(BadRequestException);
    await expect(broken.getGithubToken()).rejects.toThrow(/ENCRYPTION_KEY/);
  });
});
