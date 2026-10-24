import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { ReposRepository } from '../src/module/repos/repos.repository';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

// A fake Prisma delegate; each test overrides only what it needs.
function setup(delegate: Record<string, unknown> = {}) {
  const repository = {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    ...delegate,
  };
  return { repository, repo: new ReposRepository({ repository } as unknown as PrismaService) };
}

describe('ReposRepository.findAll', () => {
  it('hides removed repositories', async () => {
    const { repo, repository } = setup({ findMany: vi.fn().mockResolvedValue([]) });
    await repo.findAll();
    expect(repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { removedAt: null } }));
  });
});

describe('ReposRepository.add', () => {
  const data = { owner: 'a', name: 'b', baselineShas: ['s1', 's2'] };

  it('creates a new row when nothing was removed before', async () => {
    const { repo, repository } = setup({ create: vi.fn().mockResolvedValue({ id: 'new' }) });
    expect(await repo.add(data)).toEqual({ id: 'new' });
    expect(repository.create).toHaveBeenCalledWith({ data: { owner: 'a', name: 'b', baselineShas: ['s1', 's2'] } });
  });

  it('restores a removed row, keeping its id, instead of creating one', async () => {
    const { repo, repository } = setup({
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'old' }),
    });
    expect(await repo.add(data)).toEqual({ id: 'old' });
    expect(repository.updateMany).toHaveBeenCalledWith({
      where: { owner: 'a', name: 'b', removedAt: { not: null } },
      data: { removedAt: null, enabled: true, lastError: null, baselineShas: ['s1', 's2'] },
    });
    expect(repository.findUnique).toHaveBeenCalledWith({ where: { owner_name: { owner: 'a', name: 'b' } } });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns null when it is already being watched (unique violation)', async () => {
    const { repo } = setup({ create: vi.fn().mockRejectedValue(knownError('P2002')) });
    expect(await repo.add(data)).toBeNull();
  });

  it('rethrows every other error', async () => {
    const { repo } = setup({ create: vi.fn().mockRejectedValue(new Error('connection lost')) });
    await expect(repo.add(data)).rejects.toThrow('connection lost');
  });
});

describe('ReposRepository.updateEnabled', () => {
  it('updates only a non-removed row', async () => {
    const { repo, repository } = setup({ update: vi.fn().mockResolvedValue({ id: 'r1', enabled: false }) });
    expect(await repo.updateEnabled('r1', false)).toEqual({ id: 'r1', enabled: false });
    expect(repository.update).toHaveBeenCalledWith({ where: { id: 'r1', removedAt: null }, data: { enabled: false } });
  });

  it('returns null when no such row exists (record not found)', async () => {
    const { repo } = setup({ update: vi.fn().mockRejectedValue(knownError('P2025')) });
    expect(await repo.updateEnabled('missing', true)).toBeNull();
  });

  it('rethrows other errors', async () => {
    const { repo } = setup({ update: vi.fn().mockRejectedValue(knownError('P2003')) });
    await expect(repo.updateEnabled('r1', true)).rejects.toMatchObject({ code: 'P2003' });
  });
});

describe('ReposRepository.softRemove', () => {
  it('marks the row removed and paused, never deleting it', async () => {
    const { repo, repository } = setup({ updateMany: vi.fn().mockResolvedValue({ count: 1 }) });
    expect(await repo.softRemove('r1')).toBe(true);
    const call = repository.updateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ id: 'r1', removedAt: null });
    expect(call.data.enabled).toBe(false);
    expect(call.data.removedAt).toBeInstanceOf(Date);
  });

  it('returns false when nothing matched (unknown or already removed)', async () => {
    const { repo } = setup({ updateMany: vi.fn().mockResolvedValue({ count: 0 }) });
    expect(await repo.softRemove('r1')).toBe(false);
  });
});

describe('ReposRepository polling queries', () => {
  it('findPollable excludes removed and paused repositories', async () => {
    const { repo, repository } = setup({ findMany: vi.fn().mockResolvedValue([]) });
    await repo.findPollable();
    expect(repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { removedAt: null, enabled: true } }));
  });

  it('markPolled stamps the time and stores the error (null clears it)', async () => {
    const { repo, repository } = setup({ updateMany: vi.fn().mockResolvedValue({ count: 1 }) });
    await repo.markPolled('r1', 'boom');
    const call = repository.updateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ id: 'r1' });
    expect(call.data.lastError).toBe('boom');
    expect(call.data.lastPolledAt).toBeInstanceOf(Date);

    await repo.markPolled('r1', null);
    expect(repository.updateMany.mock.calls[1]![0].data.lastError).toBeNull();
  });
});
