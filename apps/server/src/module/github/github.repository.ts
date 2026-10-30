import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type InstallationData = {
  installationId: number;
  accountId: string;
  repositorySelection: string;
};

@Injectable()
export class GithubRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the installation, or brings a known one up to date and makes it live again (an App that was removed
  // and installed once more keeps its row).
  async upsertInstallation(data: InstallationData): Promise<void> {
    await this.prisma.githubInstallation.upsert({
      where: { installationId: data.installationId },
      create: data,
      update: { ...data, removedAt: null },
    });
  }

  // The installations that are live: not uninstalled, not suspended.
  findActiveInstallations() {
    return this.prisma.githubInstallation.findMany({
      where: { removedAt: null, suspendedAt: null },
      include: { account: true },
      orderBy: { account: { login: 'asc' } },
    });
  }

  // Only what changed; false when diffy never heard of this installation.
  async updateInstallation(installationId: number, data: { removedAt?: Date | null; suspendedAt?: Date | null; repositorySelection?: string }): Promise<boolean> {
    const result = await this.prisma.githubInstallation.updateMany({ where: { installationId }, data });
    return result.count > 0;
  }
}
