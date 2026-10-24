import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../src/infra/security/redact';

describe('redactSecrets', () => {
  it('replaces every occurrence of every secret', () => {
    expect(redactSecrets('a SECRET123 b SECRET123 c TOKEN456', ['SECRET123', 'TOKEN456'])).toBe('a *** b *** c ***');
  });

  it('leaves the message alone when nothing matches', () => {
    expect(redactSecrets('plain message', ['SECRET123'])).toBe('plain message');
    expect(redactSecrets('plain message', [])).toBe('plain message');
  });

  it('ignores very short or empty secrets rather than mangling the text', () => {
    expect(redactSecrets('the key is k and empty', ['k', ''])).toBe('the key is k and empty');
  });

  it('does not treat special characters in a secret as a pattern', () => {
    expect(redactSecrets('key a.b*c+d here', ['a.b*c+d'])).toBe('key *** here');
  });
});
