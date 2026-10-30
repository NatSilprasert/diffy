import { Injectable } from '@nestjs/common';
import type { LlmProvider } from '../../generated/prisma/enums';
import { isUniqueViolation } from '../../infra/prisma/prisma-errors';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type BuiltProfileData = {
  content: string;
  branch: string;
  builtCommit: string;
  provider: LlmProvider;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByRepositoryId(repositoryId: string) {
    return this.prisma.repoProfile.findUnique({ where: { repositoryId } });
  }

  // The status of every profile, without the content (which can be long).
  listStatuses(accountId: string) {
    return this.prisma.repoProfile.findMany({ where: { repository: { accountId } }, select: { repositoryId: true, status: true, builtAt: true } });
  }

  // Which of these repositories already have a profile row, whatever its status.
  async findRepositoryIdsWithProfile(repositoryIds: string[]): Promise<string[]> {
    if (repositoryIds.length === 0) return [];
    const rows = await this.prisma.repoProfile.findMany({ where: { repositoryId: { in: repositoryIds } }, select: { repositoryId: true } });
    return rows.map((row) => row.repositoryId);
  }

  // A new row in the "building" state. False when the repository already has one (two callers racing).
  async createBuilding(repositoryId: string): Promise<boolean> {
    try {
      await this.prisma.repoProfile.create({ data: { repositoryId } });
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  // failed or ready -> building again, as one conditional update: of two simultaneous rebuilds only one wins.
  // The old content stays until the new one is ready, and the notes are never touched. False when it was building.
  async markBuildingIfIdle(repositoryId: string): Promise<boolean> {
    const result = await this.prisma.repoProfile.updateMany({
      where: { repositoryId, status: { not: 'building' } },
      data: { status: 'building', error: null },
    });
    return result.count > 0;
  }

  async saveBuilt(repositoryId: string, data: BuiltProfileData): Promise<void> {
    await this.prisma.repoProfile.update({
      where: { repositoryId },
      data: { ...data, status: 'ready', error: null, builtAt: new Date() },
    });
  }

  // The previous content stays: a failed rebuild must not take away a profile that worked.
  async markFailed(repositoryId: string, error: string): Promise<void> {
    await this.prisma.repoProfile.update({ where: { repositoryId }, data: { status: 'failed', error } });
  }

  // False when the repository has no profile row.
  async updateNotes(repositoryId: string, notes: string): Promise<boolean> {
    const result = await this.prisma.repoProfile.updateMany({ where: { repositoryId }, data: { notes } });
    return result.count > 0;
  }

  // For startup: a build that was running when the server stopped starts again.
  async findBuildingRepositoryIds(): Promise<string[]> {
    const rows = await this.prisma.repoProfile.findMany({ where: { status: 'building' }, select: { repositoryId: true }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => row.repositoryId);
  }
}
