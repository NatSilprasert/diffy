import { describe, expect, it, vi } from 'vitest';
import { GetSettingsResponseSchema } from '../src/module/settings/dto/get-settings.dto';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { GetSettingsUsecase } from '../src/module/settings/usecase/get-settings.usecase';

type Row = Awaited<ReturnType<SettingsRepository['findSingleton']>>;

const run = (row: Row) =>
  new GetSettingsUsecase({ findSingleton: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository).execute();

const row = (over: Partial<NonNullable<Row>> = {}): Row => ({
  id: 1,
  githubTokenEnc: null,
  githubLogin: null,
  llmProvider: null,
  llmModel: null,
  llmApiKeyEnc: null,
  updatedAt: new Date(),
  ...over,
});

describe('GetSettingsUsecase', () => {
  it('reports nothing configured before the first save', async () => {
    const expected = { github: { configured: false, login: null }, llm: { configured: false, provider: null, model: null } };
    expect(await run(null)).toEqual(expected);
    expect(await run(row())).toEqual(expected);
  });

  it('reports GitHub as configured with its login', async () => {
    const result = await run(row({ githubTokenEnc: 'v1:x:y:z', githubLogin: 'octocat' }));
    expect(result.github).toEqual({ configured: true, login: 'octocat' });
    expect(result.llm.configured).toBe(false);
  });

  it('reports the LLM as configured and maps the provider to lower-case', async () => {
    const result = await run(row({ llmProvider: 'anthropic', llmModel: 'claude-sonnet-5-5', llmApiKeyEnc: 'v1:x:y:z' }));
    expect(result.llm).toEqual({ configured: true, provider: 'anthropic', model: 'claude-sonnet-5-5' });
  });

  it('keeps provider and model visible but not configured when the key is missing', async () => {
    const result = await run(row({ llmProvider: 'google', llmModel: 'gemini-2.5-flash' }));
    expect(result.llm).toEqual({ configured: false, provider: 'google', model: 'gemini-2.5-flash' });
  });

  it('never returns encrypted values', async () => {
    const result = await run(
      row({ githubTokenEnc: 'v1:SECRET-A:x:y', llmProvider: 'openai', llmModel: 'm', llmApiKeyEnc: 'v1:SECRET-B:x:y' }),
    );
    expect(JSON.stringify(result)).not.toMatch(/SECRET|v1:/);
    expect(GetSettingsResponseSchema.safeParse(result).success).toBe(true);
  });
});
