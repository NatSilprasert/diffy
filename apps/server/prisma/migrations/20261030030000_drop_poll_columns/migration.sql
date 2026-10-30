-- diffy no longer looks at repositories on a timer: GitHub tells it about pull requests through webhooks. So there is
-- no "last checked" time and no "last check failed" reason to keep.
ALTER TABLE "Repository" DROP COLUMN "lastPolledAt",
DROP COLUMN "lastError";
