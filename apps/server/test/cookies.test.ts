import { describe, expect, it } from 'vitest';
import { parseCookies } from '../src/infra/http/cookies';

describe('parseCookies', () => {
  it('reads every cookie of the header', () => {
    expect(parseCookies('diffy_session=abc; theme=dark;other=1')).toEqual({ diffy_session: 'abc', theme: 'dark', other: '1' });
  });

  it('decodes values, keeps = inside a value and keeps the first of a repeated name', () => {
    expect(parseCookies('a=x%20y; b=c=d; a=second')).toEqual({ a: 'x y', b: 'c=d' });
  });

  it('is empty without a header and skips what is not a cookie', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('junk; =nameless; ok=1; bad=%E0%A4%A')).toEqual({ ok: '1' });
  });
});
