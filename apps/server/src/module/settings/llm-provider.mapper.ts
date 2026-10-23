import type { LlmProvider as ApiLlmProvider } from '@diffy/shared';
import type { LlmProvider as DbLlmProvider } from '../../generated/prisma/enums';

// The database enum is UPPER_CASE, the API (and @diffy/shared) is lower-case.
// Records keep both directions exhaustive: a new provider fails the build until it is mapped.
const TO_API: Record<DbLlmProvider, ApiLlmProvider> = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  OPENROUTER: 'openrouter',
};

const TO_DB: Record<ApiLlmProvider, DbLlmProvider> = {
  openai: 'OPENAI',
  anthropic: 'ANTHROPIC',
  google: 'GOOGLE',
  openrouter: 'OPENROUTER',
};

export const toApiProvider = (provider: DbLlmProvider): ApiLlmProvider => TO_API[provider];
export const toDbProvider = (provider: ApiLlmProvider): DbLlmProvider => TO_DB[provider];
