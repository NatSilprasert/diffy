import { describe, expect, it } from 'vitest';
import { hashSessionToken, newOAuthState, newSessionToken, sameState } from '../src/infra/security/session-token';

describe('session tokens', () => {
  it('makes a different, long, url-safe token each time', () => {
    const tokens = new Set(Array.from({ length: 50 }, newSessionToken));
    expect(tokens.size).toBe(50);
    expect([...tokens].every((token) => /^[\w-]{43}$/.test(token))).toBe(true);
  });

  it('keeps a hash that is the same for the same token and cannot be turned back into it', () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken('a')).not.toBe(hashSessionToken('b'));
  });
});

describe('OAuth state', () => {
  it('makes a different state each time', () => {
    expect(newOAuthState()).not.toBe(newOAuthState());
    expect(newOAuthState()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('accepts only the same state, and nothing when one is missing', () => {
    expect(sameState('abc', 'abc')).toBe(true);
    expect(sameState('abc', 'abd')).toBe(false);
    expect(sameState('abc', 'abcd')).toBe(false);
    expect(sameState(undefined, undefined)).toBe(false);
    expect(sameState('abc', undefined)).toBe(false);
    expect(sameState('', '')).toBe(false);
  });
});
