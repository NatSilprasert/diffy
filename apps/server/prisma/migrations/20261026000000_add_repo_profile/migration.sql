-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('building', 'ready', 'failed');

-- CreateTable
CREATE TABLE "RepoProfile" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'building',
    "content" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "branch" TEXT,
    "builtCommit" TEXT,
    "builtAt" TIMESTAMP(3),
    "provider" "LlmProvider",
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepoProfile_repositoryId_key" ON "RepoProfile"("repositoryId");

-- AddForeignKey
ALTER TABLE "RepoProfile" ADD CONSTRAINT "RepoProfile_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
