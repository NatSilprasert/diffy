import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { AccountsRepository } from '../src/module/accounts/accounts.repository';

const repoWith = (account: Record<string, unknown>) => new AccountsRepository({ account } as unknown as PrismaService);

describe('AccountsRepository', () => {
  it('creates an account by its GitHub id, and keeps its login and type current', async () => {
    const upsert = vi.fn();
    await repoWith({ upsert }).upsertByGithubId({ githubId: 4242, login: 'acme', type: 'Organization' });
    expect(upsert).toHaveBeenCalledWith({
      where: { githubId: 4242 },
      create: { githubId: 4242, login: 'acme', type: 'Organization' },
      update: { login: 'acme', type: 'Organization' },
    });
  });

  it('finds by id and by login without caring about case', async () => {
    const findUnique = vi.fn();
    const findFirst = vi.fn();
    const repository = repoWith({ findUnique, findFirst });
    await repository.findById('a1');
    await repository.findByLogin('Acme');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(findFirst).toHaveBeenCalledWith({ where: { login: { equals: 'Acme', mode: 'insensitive' } } });
  });
});
