import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Settings is a singleton row (id = 1).
const SETTINGS_ID = 1;

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSingleton() {
    return this.prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  }
}
