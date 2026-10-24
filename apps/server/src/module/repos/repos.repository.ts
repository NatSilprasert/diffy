import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

const isPrismaError = (err: unknown, code: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

// Every read and write below ignores repositories the user has removed (removedAt is set).
@Injectable()
export class ReposRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.repository.findMany({
      where: { removedAt: null },
      orderBy: [{ owner: 'asc' }, { name: 'asc' }],
    });
  }

  // Restores the row if the user removed this repo earlier (keeping its review history),
  // otherwise creates it. Returns null when it is already being watched.
  async add(data: { owner: string; name: string }) {
    const restored = await this.prisma.repository.updateMany({
      where: { ...data, removedAt: { not: null } },
      data: { removedAt: null, enabled: true, lastError: null },
    });
    try {
      if (restored.count > 0) return await this.prisma.repository.findUnique({ where: { owner_name: data } });
      return await this.prisma.repository.create({ data });
    } catch (err) {
      if (isPrismaError(err, UNIQUE_CONSTRAINT_VIOLATION)) return null;
      throw err;
    }
  }

  // Returns null when there is no such (non-removed) repository.
  async updateEnabled(id: string, enabled: boolean) {
    try {
      return await this.prisma.repository.update({ where: { id, removedAt: null }, data: { enabled } });
    } catch (err) {
      if (isPrismaError(err, RECORD_NOT_FOUND)) return null;
      throw err;
    }
  }

  // Soft remove: hides the repo and stops polling, but keeps its reviews. Returns false if it was not there.
  async softRemove(id: string): Promise<boolean> {
    const result = await this.prisma.repository.updateMany({
      where: { id, removedAt: null },
      data: { removedAt: new Date(), enabled: false },
    });
    return result.count > 0;
  }
}
