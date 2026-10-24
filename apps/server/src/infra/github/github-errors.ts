import { BadGatewayException, BadRequestException, type HttpException } from '@nestjs/common';

// GitHub 401/403 means the token is wrong or lacks access (the user can fix it: 400).
// Anything else, such as no network or a GitHub outage, is not the user's doing (502).
export function toGithubHttpException(err: unknown, messages: { rejected: string; unreachable: string }): HttpException {
  const status = (err as { status?: number }).status;
  return status === 401 || status === 403
    ? new BadRequestException(messages.rejected)
    : new BadGatewayException(messages.unreachable);
}
