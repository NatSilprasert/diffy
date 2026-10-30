-- Everything diffy keeps now belongs to an Account (whoever installed the GitHub App). Repositories that were added
-- with a personal token have no account to belong to, so they go, with their reviews, findings and project briefs
-- (all of them cascade). The installation rows are rebuilt from GitHub's webhooks.
DELETE FROM "Repository";
DELETE FROM "GithubInstallation";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_githubId_key" ON "Account"("githubId");

-- AlterTable
ALTER TABLE "GithubInstallation" DROP COLUMN "accountLogin",
DROP COLUMN "accountType",
ADD COLUMN     "accountId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "accountId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "GithubInstallation" ADD CONSTRAINT "GithubInstallation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
