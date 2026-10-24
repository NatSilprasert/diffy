import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class ReposRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.repository.findMany({ orderBy: [{ owner: 'asc' }, { name: 'asc' }] });
  }

  // Returns null when (owner, name) is already watched, instead of leaking a Prisma error upward.
  async create(data: { owner: string; name: string }) {
    try {
      return await this.prisma.repository.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
        return null;
      }
      throw err;
    }
  }
}
