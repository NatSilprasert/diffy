import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type AccountData = { githubId: number; login: string; type: string };

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the account the first time GitHub tells us about it, and keeps its login and type current after that.
  upsertByGithubId(data: AccountData) {
    return this.prisma.account.upsert({
      where: { githubId: data.githubId },
      create: data,
      update: { login: data.login, type: data.type },
    });
  }

  findById(id: string) {
    return this.prisma.account.findUnique({ where: { id } });
  }

  // GitHub treats logins as case-insensitive.
  findByLogin(login: string) {
    return this.prisma.account.findFirst({ where: { login: { equals: login, mode: 'insensitive' } } });
  }
}
