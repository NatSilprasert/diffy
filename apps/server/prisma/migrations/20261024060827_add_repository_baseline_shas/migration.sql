-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "baselineShas" TEXT[] DEFAULT ARRAY[]::TEXT[];
