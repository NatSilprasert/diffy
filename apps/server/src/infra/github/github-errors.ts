import { BadGatewayException, BadRequestException, HttpException, NotFoundException } from '@nestjs/common';

// An error diffy raised itself (for example "connect GitHub first") already says what is wrong and is passed on.
// GitHub 401/403 means the token is wrong or lacks access (the user can fix it: 400).
// 404 becomes a 404 only when the caller supplies a message for it; GitHub also answers 404 for
// things the token cannot see, so the message should mention both. Anything else, such as no
// network or a GitHub outage, is not the user's doing (502).
export function toGithubHttpException(
  err: unknown,
  messages: { rejected: string; unreachable: string; notFound?: string },
): HttpException {
  if (err instanceof HttpException) return err;
  const status = (err as { status?: number }).status;
  if (status === 401 || status === 403) return new BadRequestException(messages.rejected);
  if (status === 404 && messages.notFound) return new NotFoundException(messages.notFound);
  return new BadGatewayException(messages.unreachable);
}
