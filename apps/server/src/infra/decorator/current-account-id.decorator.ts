import { createParamDecorator, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../auth/auth-context';

// The account the person is looking at, for a route that cannot do without one. A person who is signed in but cannot
// use diffy for any account yet (the App is installed nowhere they can reach) is told so.
export const CurrentAccountId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const { accountId } = context.switchToHttp().getRequest<{ auth: AuthContext }>().auth;
  if (!accountId) throw new ForbiddenException('Install the diffy GitHub App on one of your accounts first.');
  return accountId;
});
