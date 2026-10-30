import type { AuthContext } from '../auth/auth-context';

// The little of HTTP that sign-in needs, without pulling in a cookie library.

// The cookies of a request, from its Cookie header. A name that appears twice keeps its first value.
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const name = part.slice(0, at).trim();
    if (!name || name in cookies) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      // a value that is not valid percent-encoding is not one of ours
    }
  }
  return cookies;
}

// What the parts of Express that diffy touches look like, so the code does not depend on its types.
export type HttpRequest = { headers: { cookie?: string }; auth?: AuthContext };
export type CookieOptions = { httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; maxAge?: number; path?: string };
export type HttpResponse = {
  cookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: CookieOptions): void;
  redirect(url: string): void;
};
