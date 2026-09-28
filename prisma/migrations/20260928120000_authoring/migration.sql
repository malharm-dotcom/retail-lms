-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_moduleVersionId_fkey";

-- AlterTable
ALTER TABLE "ModuleVersion" ADD COLUMN     "sequential" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "assetId" TEXT;

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "url",
ADD COLUMN     "data" BYTEA NOT NULL,
ALTER COLUMN "moduleVersionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "lastReminderAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "watchedRanges" JSONB NOT NULL DEFAULT '[]';

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

