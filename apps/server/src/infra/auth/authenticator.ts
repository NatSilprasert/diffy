import type { AuthContext } from './auth-context';

// What the guard needs from whoever keeps the sessions: the person behind a session token, or null. The auth module
// provides it under AUTHENTICATOR, so this folder never has to know that module.
export interface Authenticator {
  authenticate(token: string | undefined): Promise<AuthContext | null>;
}

export const AUTHENTICATOR = Symbol('AUTHENTICATOR');
