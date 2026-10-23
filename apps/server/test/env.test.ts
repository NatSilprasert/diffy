import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/infra/config/env';

const key = Buffer.alloc(32, 7).toString('base64');
const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

describe('parseEnv', () => {
  it('applies defaults when only the encryption key is set', () => {
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url })).toEqual({
      DATABASE_URL: url,
      ENCRYPTION_KEY: key,
      PORT: 3000,
      HOST: '127.0.0.1',
      POLL_INTERVAL_SECONDS: 60,
    });
  });

  it('coerces numeric strings from the environment', () => {
    const env = parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, PORT: '4000', POLL_INTERVAL_SECONDS: '30' });
    expect(env.PORT).toBe(4000);
    expect(env.POLL_INTERVAL_SECONDS).toBe(30);
  });

  it('fails with a readable message when ENCRYPTION_KEY is missing', () => {
    expect(() => parseEnv({})).toThrow(/ENCRYPTION_KEY/);
  });

  it('fails when DATABASE_URL is missing or not a postgres URL', () => {
    expect(() => parseEnv({ ENCRYPTION_KEY: key })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: 'mysql://x' })).toThrow(/postgresql:\/\//);
  });

  it('rejects an empty key, as left by a copied .env.example', () => {
    expect(() => parseEnv({ ENCRYPTION_KEY: '' })).toThrow(/openssl rand -base64 32/);
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => parseEnv({ ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'), DATABASE_URL: url })).toThrow(/32 bytes/);
  });

  it('rejects a non-numeric port', () => {
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, PORT: 'abc' })).toThrow(/PORT/);
  });
});
