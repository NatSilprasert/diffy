import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CryptoService } from '../src/infra/crypto/crypto.service';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { SettingsService } from '../src/module/settings/settings.service';

describe('SettingsService.getLlmConfig', () => {
  const llmService = (row: Record<string, unknown> | null, decrypt: (v: string) => string = (v) => `plain(${v})`) =>
    new SettingsService(
      { findByAccountId: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository,
      { decrypt } as unknown as CryptoService,
    );
  const full = { llmProvider: 'google', llmModel: 'gemini-x', llmApiKeyEnc: 'v1:k' };

  it('returns the provider in API spelling with the decrypted key', async () => {
    expect(await llmService(full).getLlmConfig('acc1')).toEqual({ provider: 'google', model: 'gemini-x', apiKey: 'plain(v1:k)' });
  });

  it.each([
    ['no row', null],
    ['no provider', { ...full, llmProvider: null }],
    ['no model', { ...full, llmModel: null }],
    ['no key', { ...full, llmApiKeyEnc: null }],
  ])('asks the user to save settings (%s)', async (_name, row) => {
    await expect(llmService(row).getLlmConfig('acc1')).rejects.toThrow(/Save an LLM provider/);
  });

  it('explains an undecryptable key', async () => {
    const broken = llmService(full, () => {
      throw new Error('Cannot decrypt value');
    });
    await expect(broken.getLlmConfig('acc1')).rejects.toThrow(/ENCRYPTION_KEY/);
  });
});

describe('SettingsService.isLlmConfigured', () => {
  const configured = (row: Record<string, unknown> | null, decrypt = vi.fn()) =>
    new SettingsService({ findByAccountId: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository, { decrypt } as unknown as CryptoService).isLlmConfigured('acc1');
  const full = { llmProvider: 'google', llmModel: 'gemini-x', llmApiKeyEnc: 'v1:k' };

  it('is true only when the provider, the model and the key are all saved', async () => {
    expect(await configured(full)).toBe(true);
    expect(await configured({ ...full, llmApiKeyEnc: null })).toBe(false);
    expect(await configured({ ...full, llmModel: null })).toBe(false);
    expect(await configured({ ...full, llmProvider: null })).toBe(false);
    expect(await configured(null)).toBe(false);
  });

  it('does not decrypt anything', async () => {
    const decrypt = vi.fn();
    await configured(full, decrypt);
    expect(decrypt).not.toHaveBeenCalled();
  });
});
