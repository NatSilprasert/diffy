import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { ReposRepository } from '../src/module/repos/repos.repository';

const repoWith = (create: () => Promise<unknown>) =>
  new ReposRepository({ repository: { create: vi.fn(create) } } as unknown as PrismaService);

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

describe('ReposRepository.create', () => {
  it('returns the new row', async () => {
    const created = { id: 'r1' };
    expect(await repoWith(async () => created).create({ owner: 'a', name: 'b' })).toBe(created);
  });

  it('returns null on a unique-constraint violation (already watched)', async () => {
    const repo = repoWith(async () => {
      throw knownError('P2002');
    });
    expect(await repo.create({ owner: 'a', name: 'b' })).toBeNull();
  });

  it('rethrows every other error', async () => {
    const other = repoWith(async () => {
      throw knownError('P2003');
    });
    await expect(other.create({ owner: 'a', name: 'b' })).rejects.toMatchObject({ code: 'P2003' });

    const plain = repoWith(async () => {
      throw new Error('connection lost');
    });
    await expect(plain.create({ owner: 'a', name: 'b' })).rejects.toThrow('connection lost');
  });
});
