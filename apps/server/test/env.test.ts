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
      MAX_DIFF_CHARS: 150_000,
      EXPAND_DIFF_CONTEXT: true,
      VERIFY_FINDINGS: true,
      MAX_CONTEXT_CHARS: 30_000,
    });
  });

  it('reads the diff budget and refuses one too small to review anything', () => {
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, MAX_DIFF_CHARS: '300000' }).MAX_DIFF_CHARS).toBe(300_000);
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, MAX_DIFF_CHARS: '500' })).toThrow(/MAX_DIFF_CHARS/);
  });

  it('reads EXPAND_DIFF_CONTEXT as true or false', () => {
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, EXPAND_DIFF_CONTEXT: 'false' }).EXPAND_DIFF_CONTEXT).toBe(false);
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, EXPAND_DIFF_CONTEXT: 'true' }).EXPAND_DIFF_CONTEXT).toBe(true);
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, EXPAND_DIFF_CONTEXT: 'maybe' })).toThrow(/EXPAND_DIFF_CONTEXT/);
  });

  it('reads VERIFY_FINDINGS as true or false', () => {
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, VERIFY_FINDINGS: 'false' }).VERIFY_FINDINGS).toBe(false);
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, VERIFY_FINDINGS: 'maybe' })).toThrow(/VERIFY_FINDINGS/);
  });

  it('reads the GitHub App settings, all optional', () => {
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url }).GITHUB_APP_ID).toBeUndefined();
    const env = parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, GITHUB_APP_ID: '5507932', GITHUB_WEBHOOK_SECRET: 'a-long-enough-webhook-secret' });
    expect(env).toMatchObject({ GITHUB_APP_ID: 5507932, GITHUB_WEBHOOK_SECRET: 'a-long-enough-webhook-secret' });
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, GITHUB_WEBHOOK_SECRET: 'short' })).toThrow(/GITHUB_WEBHOOK_SECRET/);
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, GITHUB_APP_ID: 'abc' })).toThrow(/GITHUB_APP_ID/);
  });

  it('reads the context budget, where 0 turns the documents off', () => {
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, MAX_CONTEXT_CHARS: '0' }).MAX_CONTEXT_CHARS).toBe(0);
    expect(parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, MAX_CONTEXT_CHARS: '50000' }).MAX_CONTEXT_CHARS).toBe(50_000);
    expect(() => parseEnv({ ENCRYPTION_KEY: key, DATABASE_URL: url, MAX_CONTEXT_CHARS: '-1' })).toThrow(/MAX_CONTEXT_CHARS/);
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
