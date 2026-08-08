-- CreateEnum
CREATE TYPE "MediaStorageProvider" AS ENUM ('CLOUDINARY', 'S3');

-- AlterEnum: add PENDING_UPLOAD before existing values are used in new rows
ALTER TYPE "MediaStatus" ADD VALUE 'PENDING_UPLOAD';

-- AlterTable
ALTER TABLE "media_files"
  ADD COLUMN "storage_provider" "MediaStorageProvider",
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "cleanup_eligible_at" TIMESTAMP(3);

-- Backfill existing disposable rows (if any) as Cloudinary-ready placeholders
UPDATE "media_files"
SET "storage_provider" = 'CLOUDINARY'
WHERE "storage_provider" IS NULL;

ALTER TABLE "media_files"
  ALTER COLUMN "storage_provider" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "media_files_status_idx";

-- CreateIndex
CREATE INDEX "media_files_status_cleanup_eligible_at_idx"
  ON "media_files"("status", "cleanup_eligible_at");
