import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptString, encryptString } from '../src/infra/crypto/crypto';

const key = randomBytes(32);

// Flip one character in the given part (0 = version, 1 = iv, 2 = tag, 3 = ciphertext) of a stored value.
function tamper(payload: string, part: number): string {
  const parts = payload.split(':');
  const original = Buffer.from(parts[part]!, 'base64');
  original[0] = original[0]! ^ 0xff;
  parts[part] = original.toString('base64');
  return parts.join(':');
}

describe('encryptString / decryptString', () => {
  it('round-trips a secret', () => {
    const secret = 'github_pat_11ABC_secretvalue';
    expect(decryptString(key, encryptString(key, secret))).toBe(secret);
  });

  it('round-trips unicode and an empty string', () => {
    expect(decryptString(key, encryptString(key, 'รหัสลับ 🔑'))).toBe('รหัสลับ 🔑');
    expect(decryptString(key, encryptString(key, ''))).toBe('');
  });

  it('never stores the plaintext and uses the versioned format', () => {
    const stored = encryptString(key, 'sk-ant-supersecret');
    expect(stored).not.toContain('supersecret');
    expect(stored).toMatch(/^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]*$/);
  });

  it('produces a different ciphertext every time (fresh IV)', () => {
    expect(encryptString(key, 'same')).not.toBe(encryptString(key, 'same'));
  });

  it.each([
    ['iv', 1],
    ['auth tag', 2],
    ['ciphertext', 3],
  ])('rejects a value with a tampered %s', (_name, part) => {
    const stored = encryptString(key, 'secret');
    expect(() => decryptString(key, tamper(stored, part))).toThrow(/Cannot decrypt value/);
  });

  it('rejects the wrong key', () => {
    const stored = encryptString(key, 'secret');
    expect(() => decryptString(randomBytes(32), stored)).toThrow(/wrong ENCRYPTION_KEY/);
  });

  it('rejects a truncated auth tag', () => {
    const [v, iv, tag, ct] = encryptString(key, 'secret').split(':');
    const short = Buffer.from(tag!, 'base64').subarray(0, 4).toString('base64');
    expect(() => decryptString(key, [v, iv, short, ct].join(':'))).toThrow(/Unrecognized/);
  });

  it.each([
    ['plain text', 'not-encrypted'],
    ['unknown version', 'v2:AAAA:AAAA:AAAA'],
    ['too few parts', 'v1:AAAA'],
    ['too many parts', 'v1:a:b:c:d'],
    ['empty', ''],
  ])('rejects a malformed value (%s)', (_name, value) => {
    expect(() => decryptString(key, value)).toThrow(/Unrecognized/);
  });
});
