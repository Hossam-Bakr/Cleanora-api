-- AlterEnum
ALTER TYPE "PrivilegedActionOperation" ADD VALUE 'PRIVACY_REQUEST_REASSIGN';

-- CreateEnum
CREATE TYPE "PrivacyRequestPurpose" AS ENUM ('DEACTIVATION', 'DELETION', 'EXPORT');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrivacyRequestOutcomeCode" AS ENUM ('REQUEST_FULFILLED', 'REQUEST_REJECTED');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('AR', 'EN');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('CUSTOMER_PROFILE_IMAGE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('READY', 'PENDING_DELETE', 'DELETED');

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "owner_type" "MediaOwnerType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "status" "MediaStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_image_media_file_id" TEXT,
    "image_association_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "representative_full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engineer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "professional_title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engineer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "language" "PreferredLanguage",
    "reminders_sms" BOOLEAN NOT NULL DEFAULT false,
    "reminders_push" BOOLEAN NOT NULL DEFAULT false,
    "promotional_sms" BOOLEAN NOT NULL DEFAULT false,
    "promotional_push" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address_text" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "PrivacyRequestPurpose" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL,
    "processor_id" TEXT,
    "outcome_code" "PrivacyRequestOutcomeCode",
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "processing_at" TIMESTAMP(3),
    "terminal_at" TIMESTAMP(3),
    "purge_after" TIMESTAMP(3),

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_profile_image_media_file_id_key" ON "customer_profiles"("profile_image_media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "individual_profiles_user_id_key" ON "individual_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_profiles_user_id_key" ON "company_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "engineer_profiles_user_id_key" ON "engineer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");

-- CreateIndex
CREATE INDEX "privacy_requests_user_id_purpose_status_idx" ON "privacy_requests"("user_id", "purpose", "status");

-- CreateIndex
CREATE INDEX "privacy_requests_purge_after_idx" ON "privacy_requests"("purge_after");

-- CreateIndex
CREATE INDEX "media_files_owner_user_id_owner_type_idx" ON "media_files"("owner_user_id", "owner_type");

-- CreateIndex
CREATE INDEX "media_files_status_idx" ON "media_files"("status");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_requests_one_active_per_purpose" ON "privacy_requests"("user_id", "purpose") WHERE "status" IN ('PENDING', 'PROCESSING');

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_profile_image_media_file_id_fkey" FOREIGN KEY ("profile_image_media_file_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "individual_profiles" ADD CONSTRAINT "individual_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineer_profiles" ADD CONSTRAINT "engineer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lifecycle CHECK constraints (DEC-031; not expressible in Prisma schema)
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_pending_shape_check" CHECK (
    "status" <> 'PENDING' OR (
        "processor_id" IS NULL
        AND "processing_at" IS NULL
        AND "terminal_at" IS NULL
        AND "outcome_code" IS NULL
        AND "purge_after" IS NULL
        AND "cancelled_at" IS NULL
    )
);

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_processing_shape_check" CHECK (
    "status" <> 'PROCESSING' OR (
        "processor_id" IS NOT NULL
        AND "processing_at" IS NOT NULL
        AND "terminal_at" IS NULL
        AND "outcome_code" IS NULL
        AND "purge_after" IS NULL
    )
);

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_completed_shape_check" CHECK (
    "status" <> 'COMPLETED' OR (
        "outcome_code" = 'REQUEST_FULFILLED'
        AND "terminal_at" IS NOT NULL
        AND "purge_after" IS NOT NULL
        AND "processor_id" IS NOT NULL
    )
);

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_rejected_shape_check" CHECK (
    "status" <> 'REJECTED' OR (
        "outcome_code" = 'REQUEST_REJECTED'
        AND "terminal_at" IS NOT NULL
        AND "purge_after" IS NOT NULL
        AND "processor_id" IS NOT NULL
    )
);

ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_cancelled_shape_check" CHECK (
    "status" <> 'CANCELLED' OR (
        "cancelled_at" IS NOT NULL
        AND "terminal_at" IS NOT NULL
        AND "purge_after" IS NOT NULL
        AND "outcome_code" IS NULL
        AND "processor_id" IS NULL
        AND "processing_at" IS NULL
    )
);
