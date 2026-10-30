import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { AuthRepository } from '../src/module/auth/auth.repository';

const repoWith = (prisma: Record<string, unknown>) => new AuthRepository(prisma as unknown as PrismaService);

describe('AuthRepository', () => {
  it('creates a person the first time and keeps their login, name and picture current', async () => {
    const upsert = vi.fn();
    await repoWith({ user: { upsert } }).upsertUser({ githubId: 1, login: 'nat', name: 'Nat', avatarUrl: null });
    expect(upsert).toHaveBeenCalledWith({
      where: { githubId: 1 },
      create: { githubId: 1, login: 'nat', name: 'Nat', avatarUrl: null },
      update: { login: 'nat', name: 'Nat', avatarUrl: null },
    });
  });

  it('makes the accounts of a person exactly the given ones, in one transaction', async () => {
    const deleteMany = vi.fn().mockReturnValue('delete');
    const createMany = vi.fn().mockReturnValue('create');
    const $transaction = vi.fn().mockResolvedValue([]);
    await repoWith({ membership: { deleteMany, createMany }, $transaction }).replaceMemberships('u1', ['a1', 'a2']);

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', accountId: { notIn: ['a1', 'a2'] } } });
    expect(createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', accountId: 'a1' }, { userId: 'u1', accountId: 'a2' }], skipDuplicates: true });
    expect($transaction).toHaveBeenCalledWith(['delete', 'create']);
  });

  it('removes every account when the person can reach none', async () => {
    const deleteMany = vi.fn();
    await repoWith({ membership: { deleteMany, createMany: vi.fn() }, $transaction: vi.fn() }).replaceMemberships('u1', []);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', accountId: { notIn: [] } } });
  });

  it('creates a session and tidies up the ones that ran out', async () => {
    const create = vi.fn();
    const deleteMany = vi.fn();
    const expiresAt = new Date('2026-12-01');
    await repoWith({ session: { create, deleteMany } }).createSession({ tokenHash: 'h', userId: 'u1', expiresAt });
    expect(create).toHaveBeenCalledWith({ data: { tokenHash: 'h', userId: 'u1', expiresAt } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: expect.any(Date) } } });
  });

  it('finds a session only while it has not run out, with the accounts of the person', async () => {
    const findFirst = vi.fn();
    const now = new Date('2026-10-30');
    await repoWith({ session: { findFirst } }).findLiveSession('h', now);
    expect(findFirst).toHaveBeenCalledWith({
      where: { tokenHash: 'h', expiresAt: { gt: now } },
      include: { user: { include: { memberships: { include: { account: true }, orderBy: { account: { login: 'asc' } } } } } },
    });
  });

  it('sets the account a session looks at, and deletes a session', async () => {
    const update = vi.fn();
    const deleteMany = vi.fn();
    const repository = repoWith({ session: { update, deleteMany } });
    await repository.setSessionAccount('s1', 'a2');
    await repository.deleteSession('s1');
    expect(update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { accountId: 'a2' } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});

describe('AuthRepository.addMembershipByGithubId', () => {
  it('adds the person to the account when they have signed in before', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'u1' });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    expect(await repoWith({ user: { findUnique }, membership: { createMany } }).addMembershipByGithubId(777, 'a1')).toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { githubId: 777 }, select: { id: true } });
    expect(createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', accountId: 'a1' }], skipDuplicates: true });
  });

  it('does nothing for a person diffy has not met: they get their accounts when they first sign in', async () => {
    const createMany = vi.fn();
    expect(await repoWith({ user: { findUnique: vi.fn().mockResolvedValue(null) }, membership: { createMany } }).addMembershipByGithubId(777, 'a1')).toBe(false);
    expect(createMany).not.toHaveBeenCalled();
  });
});
