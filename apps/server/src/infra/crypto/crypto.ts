import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12; // the size GCM is designed for
const TAG_BYTES = 16;

// Stored format: v1:<iv>:<auth tag>:<ciphertext>, each part base64.
// The version prefix lets a future format change coexist with rows already in the database.
export function encryptString(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES); // a fresh IV per encryption: reusing one under the same key breaks GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join(':');
}

export function decryptString(key: Buffer, payload: string): string {
  const [version, ivB64, tagB64, ciphertextB64, ...rest] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || ciphertextB64 === undefined || rest.length > 0) {
    throw new Error('Unrecognized encrypted value format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  // Without these checks, Node accepts a truncated auth tag, which weakens the integrity guarantee.
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Unrecognized encrypted value format');
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Cannot decrypt value: wrong ENCRYPTION_KEY or corrupted data');
  }
}
