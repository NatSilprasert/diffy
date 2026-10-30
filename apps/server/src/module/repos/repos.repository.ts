import { Injectable } from '@nestjs/common';
import { isRecordNotFound, isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Every read and write below ignores repositories the user has removed (removedAt is set).
@Injectable()
export class ReposRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Null for an unknown id or a removed repository.
  findActiveById(id: string) {
    return this.prisma.repository.findFirst({ where: { id, removedAt: null } });
  }

  // The repository diffy reviews under this name (GitHub's casing is not trusted to match), or null when it is not
  // watched, was removed, or is paused.
  findPollableByName(owner: string, name: string) {
    return this.prisma.repository.findFirst({
      where: { owner: { equals: owner, mode: 'insensitive' }, name: { equals: name, mode: 'insensitive' }, removedAt: null, enabled: true },
    });
  }

  // Names for a set of ids, including repositories that were removed (their reviews are still in the history).
  findNamesByIds(ids: string[]) {
    return this.prisma.repository.findMany({ where: { id: { in: ids } }, select: { id: true, owner: true, name: true } });
  }

  // A repository of this account, or null when there is none (or it belongs to someone else's account).
  findActiveOfAccount(id: string, accountId: string) {
    return this.prisma.repository.findFirst({ where: { id, accountId, removedAt: null } });
  }

  findAll(accountId: string) {
    return this.prisma.repository.findMany({
      where: { accountId, removedAt: null },
      orderBy: [{ owner: 'asc' }, { name: 'asc' }],
    });
  }

  // Restores the row if the user removed this repo earlier (keeping its review history),
  // otherwise creates it. Returns null when it is already being watched.
  async add({ accountId, owner, name, baselineShas }: { accountId: string; owner: string; name: string; baselineShas: string[] }) {
    const restored = await this.prisma.repository.updateMany({
      where: { owner, name, removedAt: { not: null } },
      data: { accountId, removedAt: null, enabled: true, lastError: null, baselineShas },
    });
    try {
      if (restored.count > 0) return await this.prisma.repository.findUnique({ where: { owner_name: { owner, name } } });
      return await this.prisma.repository.create({ data: { accountId, owner, name, baselineShas } });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  // Returns null when there is no such (non-removed) repository.
  async updateEnabled(id: string, accountId: string, enabled: boolean) {
    try {
      return await this.prisma.repository.update({ where: { id, accountId, removedAt: null }, data: { enabled } });
    } catch (err) {
      if (isRecordNotFound(err)) return null;
      throw err;
    }
  }

  // Soft remove: hides the repo and stops polling, but keeps its reviews. Returns false if it was not there.
  async softRemove(id: string, accountId: string): Promise<boolean> {
    const result = await this.prisma.repository.updateMany({
      where: { id, accountId, removedAt: null },
      data: { removedAt: new Date(), enabled: false },
    });
    return result.count > 0;
  }

  // Repositories the poller should look at: not removed and not paused.
  findPollable() {
    return this.prisma.repository.findMany({
      where: { removedAt: null, enabled: true },
      orderBy: [{ owner: 'asc' }, { name: 'asc' }],
    });
  }

  // lastError = null records a clean poll. The repository may have been removed meanwhile; that is fine.
  async markPolled(id: string, lastError: string | null): Promise<void> {
    await this.prisma.repository.updateMany({ where: { id }, data: { lastPolledAt: new Date(), lastError } });
  }
}
