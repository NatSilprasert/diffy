import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CryptoService } from '../src/infra/crypto/crypto.service';
import { UpdateLlmSettingsRequestSchema } from '../src/module/settings/dto/update-llm-settings.dto';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { UpdateLlmSettingsUsecase } from '../src/module/settings/usecase/update-llm-settings.usecase';

type Row = Awaited<ReturnType<SettingsRepository['findSingleton']>>;

const findSingleton = vi.fn();
const upsertLlm = vi.fn();
const usecase = new UpdateLlmSettingsUsecase(
  { findSingleton, upsertLlm } as unknown as SettingsRepository,
  { encrypt: (plain: string) => `enc(${plain})` } as unknown as CryptoService,
);

const saved = (over: Partial<NonNullable<Row>> = {}): Row => ({
  id: 1,
  githubTokenEnc: null,
  githubLogin: null,
  llmProvider: 'openai',
  llmModel: 'gpt-x',
  llmApiKeyEnc: 'v1:saved-key',
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  findSingleton.mockReset();
  upsertLlm.mockReset();
});

describe('UpdateLlmSettingsUsecase', () => {
  it('encrypts and saves a new key (first save, no row yet)', async () => {
    findSingleton.mockResolvedValue(null);
    const result = await usecase.execute({ provider: 'anthropic', model: 'claude-x', apiKey: 'sk-ant-1' });

    expect(result).toEqual({ provider: 'anthropic', model: 'claude-x' });
    expect(upsertLlm).toHaveBeenCalledWith({ llmProvider: 'anthropic', llmModel: 'claude-x', llmApiKeyEnc: 'enc(sk-ant-1)' });
    expect(JSON.stringify(result)).not.toContain('sk-ant');
  });

  it('replaces the saved key when a new one is sent', async () => {
    findSingleton.mockResolvedValue(saved());
    await usecase.execute({ provider: 'openai', model: 'gpt-x', apiKey: 'sk-new' });
    expect(upsertLlm).toHaveBeenCalledWith(expect.objectContaining({ llmApiKeyEnc: 'enc(sk-new)' }));
  });

  it('keeps the saved key when the key is omitted for the same provider (model change only)', async () => {
    findSingleton.mockResolvedValue(saved());
    await usecase.execute({ provider: 'openai', model: 'gpt-y' });
    expect(upsertLlm).toHaveBeenCalledWith({ llmProvider: 'openai', llmModel: 'gpt-y', llmApiKeyEnc: 'v1:saved-key' });
  });

  it('treats an empty key as omitted', async () => {
    findSingleton.mockResolvedValue(saved());
    await usecase.execute({ provider: 'openai', model: 'gpt-y', apiKey: '' });
    expect(upsertLlm).toHaveBeenCalledWith(expect.objectContaining({ llmApiKeyEnc: 'v1:saved-key' }));
  });

  it('requires a key when the provider changes, and saves nothing', async () => {
    findSingleton.mockResolvedValue(saved());
    await expect(usecase.execute({ provider: 'google', model: 'gemini-x' })).rejects.toThrow(/when you change the provider/);
    expect(upsertLlm).not.toHaveBeenCalled();
  });

  it('requires a key when none was ever saved', async () => {
    findSingleton.mockResolvedValue(null);
    await expect(usecase.execute({ provider: 'openai', model: 'gpt-x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertLlm).not.toHaveBeenCalled();
  });

  it('requires a key when the provider matches but its key is missing', async () => {
    findSingleton.mockResolvedValue(saved({ llmApiKeyEnc: null }));
    await expect(usecase.execute({ provider: 'openai', model: 'gpt-x' })).rejects.toThrow('An API key is required.');
  });
});

describe('UpdateLlmSettingsRequestSchema', () => {
  it('trims model and key', () => {
    expect(UpdateLlmSettingsRequestSchema.parse({ provider: 'openai', model: ' gpt-x ', apiKey: ' k\n' })).toEqual({
      provider: 'openai',
      model: 'gpt-x',
      apiKey: 'k',
    });
  });

  it.each([
    [{ model: 'm' }],
    [{ provider: 'claude', model: 'm' }],
    [{ provider: 'OPENAI', model: 'm' }],
    [{ provider: 'openai' }],
    [{ provider: 'openai', model: '  ' }],
    [{ provider: 'openai', model: 'm', apiKey: 42 }],
  ])('rejects %j', (body) => {
    expect(UpdateLlmSettingsRequestSchema.safeParse(body).success).toBe(false);
  });
});
