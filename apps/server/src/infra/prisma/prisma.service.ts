import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

// Runtime queries use DATABASE_URL (Supabase transaction pooler, port 6543).
// Migrations use DIRECT_URL through prisma.config.ts and never go through this class.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  async onModuleInit() {
    // $connect() alone is lazy with a driver adapter, so run a real query. A wrong
    // DATABASE_URL then fails at startup instead of on the first request.
    try {
      await this.$queryRaw`SELECT 1`;
    } catch (err) {
      // Prisma wraps the driver error in a multi-line message; the last line is the actual cause.
      const message = err instanceof Error ? err.message : String(err);
      const reason = message.split('\n').map((line) => line.trim()).filter(Boolean).pop();
      throw new Error(`Cannot connect to the database. Check DATABASE_URL in .env. (${reason})`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
