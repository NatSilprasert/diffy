import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/infra/config/env';

const key = Buffer.alloc(32, 7).toString('base64');
const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const secret = 'a-long-enough-webhook-secret';
// What diffy needs to start: the database, the encryption key and the GitHub App.
const base = { ENCRYPTION_KEY: key, DATABASE_URL: url, GITHUB_APP_ID: '5507932', GITHUB_APP_PRIVATE_KEY_PATH: 'app.pem', GITHUB_WEBHOOK_SECRET: secret, GITHUB_CLIENT_ID: 'Iv23liabc', GITHUB_CLIENT_SECRET: 'client-secret' };

describe('parseEnv', () => {
  it('applies defaults when only what is required is set', () => {
    expect(parseEnv(base)).toEqual({
      DATABASE_URL: url,
      ENCRYPTION_KEY: key,
      GITHUB_APP_ID: 5507932,
      GITHUB_APP_PRIVATE_KEY_PATH: 'app.pem',
      GITHUB_WEBHOOK_SECRET: secret,
      GITHUB_CLIENT_ID: 'Iv23liabc',
      GITHUB_CLIENT_SECRET: 'client-secret',
      PORT: 3000,
      HOST: '127.0.0.1',
      MAX_DIFF_CHARS: 150_000,
      EXPAND_DIFF_CONTEXT: true,
      VERIFY_FINDINGS: true,
      MAX_CONTEXT_CHARS: 30_000,
    });
  });

  it('reads the diff budget and refuses one too small to review anything', () => {
    expect(parseEnv({ ...base, MAX_DIFF_CHARS: '300000' }).MAX_DIFF_CHARS).toBe(300_000);
    expect(() => parseEnv({ ...base, MAX_DIFF_CHARS: '500' })).toThrow(/MAX_DIFF_CHARS/);
  });

  it('reads EXPAND_DIFF_CONTEXT as true or false', () => {
    expect(parseEnv({ ...base, EXPAND_DIFF_CONTEXT: 'false' }).EXPAND_DIFF_CONTEXT).toBe(false);
    expect(parseEnv({ ...base, EXPAND_DIFF_CONTEXT: 'true' }).EXPAND_DIFF_CONTEXT).toBe(true);
    expect(() => parseEnv({ ...base, EXPAND_DIFF_CONTEXT: 'maybe' })).toThrow(/EXPAND_DIFF_CONTEXT/);
  });

  it('reads VERIFY_FINDINGS as true or false', () => {
    expect(parseEnv({ ...base, VERIFY_FINDINGS: 'false' }).VERIFY_FINDINGS).toBe(false);
    expect(() => parseEnv({ ...base, VERIFY_FINDINGS: 'maybe' })).toThrow(/VERIFY_FINDINGS/);
  });

  it('requires the GitHub App: its id, the key file and the webhook secret', () => {
    const { GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, GITHUB_WEBHOOK_SECRET, ...without } = base;
    expect(() => parseEnv(without)).toThrow(/GITHUB_APP_ID[\s\S]*GITHUB_APP_PRIVATE_KEY_PATH[\s\S]*GITHUB_WEBHOOK_SECRET/);
    expect(() => parseEnv({ ...base, GITHUB_APP_ID: 'abc' })).toThrow(/GITHUB_APP_ID/);
    expect(() => parseEnv({ ...base, GITHUB_WEBHOOK_SECRET: 'short' })).toThrow(/GITHUB_WEBHOOK_SECRET/);
  });

  it('requires the sign-in credentials of the App, and takes the two addresses as optional urls', () => {
    const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ...without } = base;
    expect(() => parseEnv(without)).toThrow(/GITHUB_CLIENT_ID[\s\S]*GITHUB_CLIENT_SECRET/);

    const env = parseEnv({ ...base, PUBLIC_URL: 'https://diffy.example.com', WEB_URL: 'http://localhost:3000' });
    expect(env).toMatchObject({ PUBLIC_URL: 'https://diffy.example.com', WEB_URL: 'http://localhost:3000' });
    expect(parseEnv(base).PUBLIC_URL).toBeUndefined();
    expect(() => parseEnv({ ...base, PUBLIC_URL: 'not a url' })).toThrow(/PUBLIC_URL/);
  });

  it('reads the context budget, where 0 turns the documents off', () => {
    expect(parseEnv({ ...base, MAX_CONTEXT_CHARS: '0' }).MAX_CONTEXT_CHARS).toBe(0);
    expect(parseEnv({ ...base, MAX_CONTEXT_CHARS: '50000' }).MAX_CONTEXT_CHARS).toBe(50_000);
    expect(() => parseEnv({ ...base, MAX_CONTEXT_CHARS: '-1' })).toThrow(/MAX_CONTEXT_CHARS/);
  });

  it('coerces numeric strings from the environment', () => {
    const env = parseEnv({ ...base, PORT: '4000', MAX_DIFF_CHARS: '30000' });
    expect(env.PORT).toBe(4000);
    expect(env.MAX_DIFF_CHARS).toBe(30_000);
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
    expect(() => parseEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
