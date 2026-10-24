import { Prisma } from '../../generated/prisma/client';

const hasCode = (err: unknown, code: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;

// A unique constraint was violated, e.g. adding a repository or review that already exists.
export const isUniqueViolation = (err: unknown) => hasCode(err, 'P2002');

// update/delete found no row matching the where clause.
export const isRecordNotFound = (err: unknown) => hasCode(err, 'P2025');
