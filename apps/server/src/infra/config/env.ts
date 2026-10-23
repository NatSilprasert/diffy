import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const EncryptionKey = z
  .string()
  .refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'must be 32 bytes, base64-encoded (generate one with: openssl rand -base64 32)',
  );

export const EnvSchema = z.object({
  // Runtime connection. DIRECT_URL is only read by the Prisma CLI (prisma.config.ts) for migrations.
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string (see .env.example)'),
  ENCRYPTION_KEY: EncryptionKey,
  PORT: z.coerce.number().int().positive().default(3000),
  // No auth in v1, so listen on localhost only unless the user opts out.
  HOST: z.string().min(1).default('127.0.0.1'),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment. Fix your .env (see .env.example):\n${problems.join('\n')}`);
}

// The single .env lives at the repo root; pnpm runs the server with apps/server as cwd.
const ENV_FILE_CANDIDATES = ['../../.env', '.env'];

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;
  for (const candidate of ENV_FILE_CANDIDATES) {
    const file = resolve(process.cwd(), candidate);
    // loadEnvFile never overrides variables that are already set in the shell.
    if (existsSync(file)) {
      process.loadEnvFile(file);
      break;
    }
  }
  cached = parseEnv(process.env);
  return cached;
}
