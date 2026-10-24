-- Enum values become lower-case so the database, the Prisma client, the API and @diffy/shared all
-- use the same spelling. RENAME VALUE keeps existing rows (and the column default) intact.

ALTER TYPE "LlmProvider" RENAME VALUE 'OPENAI' TO 'openai';
ALTER TYPE "LlmProvider" RENAME VALUE 'ANTHROPIC' TO 'anthropic';
ALTER TYPE "LlmProvider" RENAME VALUE 'GOOGLE' TO 'google';
ALTER TYPE "LlmProvider" RENAME VALUE 'OPENROUTER' TO 'openrouter';

ALTER TYPE "ReviewStatus" RENAME VALUE 'QUEUED' TO 'queued';
ALTER TYPE "ReviewStatus" RENAME VALUE 'RUNNING' TO 'running';
ALTER TYPE "ReviewStatus" RENAME VALUE 'POSTED' TO 'posted';
ALTER TYPE "ReviewStatus" RENAME VALUE 'FAILED' TO 'failed';
ALTER TYPE "ReviewStatus" RENAME VALUE 'SKIPPED' TO 'skipped';

ALTER TYPE "Severity" RENAME VALUE 'CRITICAL' TO 'critical';
ALTER TYPE "Severity" RENAME VALUE 'HIGH' TO 'high';
ALTER TYPE "Severity" RENAME VALUE 'MEDIUM' TO 'medium';
ALTER TYPE "Severity" RENAME VALUE 'LOW' TO 'low';

ALTER TYPE "Placement" RENAME VALUE 'INLINE' TO 'inline';
ALTER TYPE "Placement" RENAME VALUE 'SUMMARY' TO 'summary';
