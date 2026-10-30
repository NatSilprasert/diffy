import { describe, expect, it, vi } from 'vitest';
import type { GithubService } from '../src/module/github/github.service';
import { GetSettingsResponseSchema } from '../src/module/settings/dto/get-settings.dto';
import type { SettingsRepository } from '../src/module/settings/settings.repository';
import { GetSettingsUsecase } from '../src/module/settings/usecase/get-settings.usecase';

type Row = Awaited<ReturnType<SettingsRepository['findSingleton']>>;

const app = { name: 'diffy-dev', slug: 'diffy-dev', installUrl: 'https://github.com/apps/diffy-dev/installations/new' };

function run(row: Row, github: { accounts?: unknown[]; app?: unknown; appError?: Error } = {}) {
  return new GetSettingsUsecase(
    { findSingleton: vi.fn().mockResolvedValue(row) } as unknown as SettingsRepository,
    {
      listInstalledAccounts: vi.fn().mockResolvedValue(github.accounts ?? []),
      getAppInfo: github.appError ? vi.fn().mockRejectedValue(github.appError) : vi.fn().mockResolvedValue(github.app ?? app),
    } as unknown as GithubService,
  ).execute();
}

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
  it('reports the model as not configured before the first save, and GitHub as not installed anywhere', async () => {
    const expected = { github: { configured: false, appName: 'diffy-dev', installUrl: app.installUrl, accounts: [] }, llm: { configured: false, provider: null, model: null } };
    expect(await run(null)).toEqual(expected);
    expect(await run(row())).toEqual(expected);
  });

  it('reports GitHub as configured once the App is installed, with where', async () => {
    const result = await run(row(), {
      accounts: [
        { login: 'NatSilprasert', type: 'User', repositorySelection: 'selected' },
        { login: 'acme', type: 'Organization', repositorySelection: 'all' },
      ],
    });
    expect(result.github.configured).toBe(true);
    expect(result.github.accounts).toEqual([
      { login: 'NatSilprasert', type: 'User', repositorySelection: 'selected' },
      { login: 'acme', type: 'Organization', repositorySelection: 'all' },
    ]);
  });

  it('still answers when GitHub cannot say who the App is, only without the name', async () => {
    const result = await run(row(), { appError: new Error('GitHub is down'), accounts: [{ login: 'a', type: 'User', repositorySelection: 'all' }] });
    expect(result.github).toMatchObject({ configured: true, appName: null, installUrl: null });
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
    const result = await run(row({ githubTokenEnc: 'v1:SECRET-A:x:y', llmProvider: 'openai', llmModel: 'm', llmApiKeyEnc: 'v1:SECRET-B:x:y' }));
    expect(JSON.stringify(result)).not.toMatch(/SECRET|v1:/);
    expect(GetSettingsResponseSchema.safeParse(result).success).toBe(true);
  });
});
