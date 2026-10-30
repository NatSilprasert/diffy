import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthContext } from '../auth/auth-context';

// Who is making the request. Only set on routes the guard let through, so it is there on every route that is not public.
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthContext => {
  return context.switchToHttp().getRequest<{ auth: AuthContext }>().auth;
});
