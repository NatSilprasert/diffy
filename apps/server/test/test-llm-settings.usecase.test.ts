import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@diffy/core', () => ({ pingLlm: vi.fn() }));

import { pingLlm } from '@diffy/core';
import type { CryptoService } from '../src/infra/crypto/crypto.service';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { TestLlmSettingsUsecase } from '../src/module/settings/usecase/test-llm-settings.usecase';

type Row = Awaited<ReturnType<SettingsRepository['findSingleton']>>;

const findSingleton = vi.fn();
const decrypt = vi.fn();
const usecase = new TestLlmSettingsUsecase(
  { findSingleton } as unknown as SettingsRepository,
  { decrypt } as unknown as CryptoService,
);

const saved = (over: Partial<NonNullable<Row>> = {}): Row => ({
  id: 1,
  githubTokenEnc: null,
  githubLogin: null,
  llmProvider: 'anthropic',
  llmModel: 'claude-x',
  llmApiKeyEnc: 'v1:enc',
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  findSingleton.mockReset();
  decrypt.mockReset().mockReturnValue('sk-ant-REALSECRET');
  vi.mocked(pingLlm).mockReset();
});

describe('TestLlmSettingsUsecase', () => {
  it('calls the LLM with the decrypted key and reports success with the latency', async () => {
    findSingleton.mockResolvedValue(saved());
    vi.mocked(pingLlm).mockResolvedValue(undefined);

    const result = await usecase.execute();

    expect(result).toMatchObject({ ok: true, error: null });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(pingLlm).toHaveBeenCalledWith({
      provider: 'anthropic',
      model: 'claude-x',
      apiKey: 'sk-ant-REALSECRET',
      timeoutMs: 60_000,
    });
  });

  it('reports a provider failure as ok: false with the message (still a normal result)', async () => {
    findSingleton.mockResolvedValue(saved());
    vi.mocked(pingLlm).mockRejectedValue(new Error('LLM call failed (anthropic/claude-x): invalid x-api-key'));

    const result = await usecase.execute();
    expect(result).toMatchObject({ ok: false, error: 'LLM call failed (anthropic/claude-x): invalid x-api-key' });
  });

  it('redacts the key if the provider echoes it back in the error', async () => {
    findSingleton.mockResolvedValue(saved());
    vi.mocked(pingLlm).mockRejectedValue(new Error('Incorrect API key provided: sk-ant-REALSECRET.'));

    const result = await usecase.execute();
    expect(result.error).toBe('Incorrect API key provided: ***.');
    expect(JSON.stringify(result)).not.toContain('REALSECRET');
  });

  it('explains an undecryptable key without calling the LLM', async () => {
    findSingleton.mockResolvedValue(saved());
    decrypt.mockImplementation(() => {
      throw new Error('Cannot decrypt value');
    });

    const result = await usecase.execute();
    expect(result).toMatchObject({ ok: false, latencyMs: null });
    expect(result.error).toMatch(/ENCRYPTION_KEY/);
    expect(pingLlm).not.toHaveBeenCalled();
  });

  it.each([
    ['no row', null],
    ['no key', saved({ llmApiKeyEnc: null })],
    ['no model', saved({ llmModel: null })],
    ['no provider', saved({ llmProvider: null })],
  ])('returns 400 when settings are incomplete (%s)', async (_name, row) => {
    findSingleton.mockResolvedValue(row);
    await expect(usecase.execute()).rejects.toBeInstanceOf(BadRequestException);
    expect(pingLlm).not.toHaveBeenCalled();
  });
});
