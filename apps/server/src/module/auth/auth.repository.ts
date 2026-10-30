import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type UserData = { githubId: number; login: string; name: string | null; avatarUrl: string | null };

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the person the first time they sign in, and keeps their login, name and picture current after that.
  upsertUser(data: UserData) {
    return this.prisma.user.upsert({
      where: { githubId: data.githubId },
      create: data,
      update: { login: data.login, name: data.name, avatarUrl: data.avatarUrl },
    });
  }

  // Makes the accounts of a person exactly these: the new ones are added, the ones they can no longer reach are removed.
  async replaceMemberships(userId: string, accountIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.membership.deleteMany({ where: { userId, accountId: { notIn: accountIds } } }),
      this.prisma.membership.createMany({ data: accountIds.map((accountId) => ({ userId, accountId })), skipDuplicates: true }),
    ]);
  }

  async createSession(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.prisma.session.create({ data });
    // Sessions that ran out are of no use to anyone: tidy them up whenever a new one is made.
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  // The session of this token, if it has not run out, with who it belongs to and where they can look.
  findLiveSession(tokenHash: string, now: Date = new Date()) {
    return this.prisma.session.findFirst({
      where: { tokenHash, expiresAt: { gt: now } },
      include: {
        user: { include: { memberships: { include: { account: true }, orderBy: { account: { login: 'asc' } } } } },
      },
    });
  }

  async setSessionAccount(sessionId: string, accountId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { accountId } });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
