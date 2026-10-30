import { describe, expect, it, vi } from 'vitest';
import type { AccountsRepository } from '../src/module/accounts/accounts.repository';
import { AccountsService } from '../src/module/accounts/accounts.service';

const row = { id: 'a1', githubId: 4242, login: 'acme', type: 'Organization', createdAt: new Date(), updatedAt: new Date() };

const service = (repository: Record<string, unknown>) => new AccountsService(repository as unknown as AccountsRepository);

describe('AccountsService', () => {
  it('records an account and returns only what other modules need', async () => {
    const upsertByGithubId = vi.fn().mockResolvedValue(row);
    expect(await service({ upsertByGithubId }).recordAccount({ githubId: 4242, login: 'acme', type: 'Organization' })).toEqual({
      id: 'a1',
      githubId: 4242,
      login: 'acme',
      type: 'Organization',
    });
    expect(upsertByGithubId).toHaveBeenCalledWith({ githubId: 4242, login: 'acme', type: 'Organization' });
  });

  it('finds an account by id or by login, or says there is none', async () => {
    const found = service({ findById: vi.fn().mockResolvedValue(row), findByLogin: vi.fn().mockResolvedValue(row) });
    expect((await found.findById('a1'))?.login).toBe('acme');
    expect((await found.findByLogin('ACME'))?.id).toBe('a1');

    const none = service({ findById: vi.fn().mockResolvedValue(null), findByLogin: vi.fn().mockResolvedValue(null) });
    expect(await none.findById('x')).toBeNull();
    expect(await none.findByLogin('x')).toBeNull();
  });
});
