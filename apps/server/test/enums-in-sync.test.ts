import { LlmProvider, Placement, ProfileStatus, ReviewStatus, Severity } from '@diffy/shared';
import { describe, expect, it } from 'vitest';
import * as db from '../src/generated/prisma/enums';

// The Prisma enums (database) and the Zod enums (@diffy/shared, used by the API) are written
// separately but must hold exactly the same values: nothing converts between them. If someone adds a
// value to one side only, this fails instead of a review failing at runtime.
const sorted = (values: readonly string[]) => [...values].sort();

describe('database enums match @diffy/shared', () => {
  it.each([
    ['LlmProvider', db.LlmProvider, LlmProvider.options],
    ['ReviewStatus', db.ReviewStatus, ReviewStatus.options],
    ['Severity', db.Severity, Severity.options],
    ['Placement', db.Placement, Placement.options],
    ['ProfileStatus', db.ProfileStatus, ProfileStatus.options],
  ])('%s', (_name, prismaEnum, sharedOptions) => {
    expect(sorted(Object.values(prismaEnum))).toEqual(sorted(sharedOptions));
  });
});
