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

describe('SettingsService.getLlmConfig', () => {
  const llmService = (row: Record<string, unknown> | null, decrypt: (v: string) => string = (v) => `plain(${v})`) =>
    new SettingsService(
      { findSingleton: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository,
      { decrypt } as unknown as CryptoService,
    );
  const full = { llmProvider: 'google', llmModel: 'gemini-x', llmApiKeyEnc: 'v1:k' };

  it('returns the provider in API spelling with the decrypted key', async () => {
    expect(await llmService(full).getLlmConfig()).toEqual({ provider: 'google', model: 'gemini-x', apiKey: 'plain(v1:k)' });
  });

  it.each([
    ['no row', null],
    ['no provider', { ...full, llmProvider: null }],
    ['no model', { ...full, llmModel: null }],
    ['no key', { ...full, llmApiKeyEnc: null }],
  ])('asks the user to save settings (%s)', async (_name, row) => {
    await expect(llmService(row).getLlmConfig()).rejects.toThrow(/Save an LLM provider/);
  });

  it('explains an undecryptable key', async () => {
    const broken = llmService(full, () => {
      throw new Error('Cannot decrypt value');
    });
    await expect(broken.getLlmConfig()).rejects.toThrow(/ENCRYPTION_KEY/);
  });
});

describe('SettingsService.isConfigured', () => {
  const configured = (row: Record<string, unknown> | null) =>
    new SettingsService(
      { findSingleton: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository,
      { decrypt: vi.fn() } as unknown as CryptoService,
    ).isConfigured();
  const full = { githubTokenEnc: 'v1:g', llmProvider: 'google', llmModel: 'gemini-x', llmApiKeyEnc: 'v1:k' };

  it('is true only when GitHub and the model are both saved', async () => {
    expect(await configured(full)).toBe(true);
    expect(await configured({ ...full, githubTokenEnc: null })).toBe(false);
    expect(await configured({ ...full, llmApiKeyEnc: null })).toBe(false);
    expect(await configured({ ...full, llmModel: null })).toBe(false);
    expect(await configured(null)).toBe(false);
  });

  it('does not decrypt anything', async () => {
    const decrypt = vi.fn();
    await new SettingsService({ findSingleton: vi.fn().mockResolvedValue(full) } as unknown as SettingsRepository, { decrypt } as unknown as CryptoService).isConfigured();
    expect(decrypt).not.toHaveBeenCalled();
  });
});
