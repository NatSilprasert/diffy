import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// A new random token for a browser to keep in its cookie. 256 bits: it cannot be guessed.
export const newSessionToken = () => randomBytes(32).toString('base64url');

// What the database keeps instead of the token itself.
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

// A random value that ties the way back from GitHub to the way out, so that a link someone else made cannot sign you in.
export const newOAuthState = () => randomBytes(16).toString('hex');

export function sameState(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
