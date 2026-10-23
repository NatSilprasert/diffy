import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself. The single .env lives at the repo root.
const rootEnv = resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Migrations need a real (non-pooled) connection: advisory locks and DDL break on the transaction pooler.
    url: process.env.DIRECT_URL ?? '',
  },
});
