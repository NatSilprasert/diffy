-- The model settings belong to an account now, not to the one installation of diffy. The settings that exist go to the
-- account when there is exactly one (the person who has been using diffy alone); with none or several there is no
-- telling whose they are, so they go. The GitHub token columns are not used any more.
ALTER TABLE "Settings" ADD COLUMN "accountId" TEXT;

UPDATE "Settings"
SET "accountId" = (SELECT "id" FROM "Account" LIMIT 1)
WHERE (SELECT count(*) FROM "Account") = 1;

DELETE FROM "Settings" WHERE "accountId" IS NULL;

ALTER TABLE "Settings" DROP CONSTRAINT "Settings_pkey",
DROP COLUMN "id",
DROP COLUMN "githubTokenEnc",
DROP COLUMN "githubLogin",
ALTER COLUMN "accountId" SET NOT NULL,
ADD CONSTRAINT "Settings_pkey" PRIMARY KEY ("accountId");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
