import { Injectable } from '@nestjs/common';
import type { LlmProvider } from '../../generated/prisma/enums';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByAccountId(accountId: string) {
    return this.prisma.settings.findUnique({ where: { accountId } });
  }

  upsertLlm(accountId: string, data: { llmProvider: LlmProvider; llmModel: string; llmApiKeyEnc: string }) {
    return this.prisma.settings.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
  }
}
