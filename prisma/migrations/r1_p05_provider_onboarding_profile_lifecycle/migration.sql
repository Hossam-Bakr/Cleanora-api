-- R1-P05 Provider Onboarding, Profile & Lifecycle
-- Forward-only: eight Provider tables, invitation OTP shape, deliberate
-- users_categories_nonempty_check removal, and Provider media enum extensions.
-- Do not remove product tables in this migration.

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('INDIVIDUAL_TEAM', 'REGISTERED_COMPANY');

CREATE TYPE "ProviderApplicationStatus" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "ProviderOperationalStatus" AS ENUM ('INACTIVE', 'LIVE', 'SUSPENDED');

CREATE TYPE "ProviderStatusDomain" AS ENUM ('APPLICATION', 'OPERATIONAL');

CREATE TYPE "ProviderMembershipLevel" AS ENUM ('OWNER', 'ADMIN');

CREATE TYPE "ProviderMembershipStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "ProviderInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TYPE "ProviderGalleryKind" AS ENUM ('IMAGE', 'VIDEO');

CREATE TYPE "ProviderEmailTemplate" AS ENUM (
  'APPLICATION_SUBMITTED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'REINSTATED'
);

CREATE TYPE "ProviderEmailOutboxStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION';

ALTER TYPE "MediaOwnerType" ADD VALUE 'PROVIDER_LOGO';
ALTER TYPE "MediaOwnerType" ADD VALUE 'PROVIDER_COVER';
ALTER TYPE "MediaOwnerType" ADD VALUE 'PROVIDER_GALLERY_IMAGE';
ALTER TYPE "MediaOwnerType" ADD VALUE 'PROVIDER_GALLERY_VIDEO';

ALTER TYPE "MediaStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "MediaStatus" ADD VALUE 'FAILED';

-- Invitation-only empty-category identities are Authentication-owned; public
-- enrollment continues to require a non-empty category at the application layer.
ALTER TABLE "users" DROP CONSTRAINT "users_categories_nonempty_check";

-- Nullable OTP category with purpose/channel shape CHECK
ALTER TABLE "otp_codes" ALTER COLUMN "account_category" DROP NOT NULL;

-- Compare via ::text so the newly added enum label is usable inside the
-- same migration transaction (PostgreSQL ADD VALUE visibility rule).
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_purpose_shape_check" CHECK (
  (
    "purpose"::text = 'PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION'
    AND "account_category" IS NULL
    AND "channel" = 'EMAIL'
  )
  OR (
    "purpose"::text <> 'PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION'
    AND "account_category" IS NOT NULL
  )
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "application_owner_user_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "kind" "ProviderKind" NOT NULL,
    "application_status" "ProviderApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "operational_status" "ProviderOperationalStatus" NOT NULL DEFAULT 'INACTIVE',
    "review_cycle" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "first_submitted_at" TIMESTAMP(3),
    "last_submitted_at" TIMESTAMP(3),
    "application_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operational_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "display_name_ar" VARCHAR(200),
    "display_name_en" VARCHAR(200),
    "description_ar" VARCHAR(4000),
    "description_en" VARCHAR(4000),
    "country_id" TEXT,
    "logo_media_file_id" TEXT,
    "cover_media_file_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_contacts" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "operational_email_normalized" VARCHAR(320),
    "operational_phone_e164" VARCHAR(16),
    "channels" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_status_history" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "domain" "ProviderStatusDomain" NOT NULL,
    "from_application_status" "ProviderApplicationStatus",
    "to_application_status" "ProviderApplicationStatus",
    "from_operational_status" "ProviderOperationalStatus",
    "to_operational_status" "ProviderOperationalStatus",
    "review_cycle" INTEGER,
    "actor_user_id" TEXT NOT NULL,
    "reason" VARCHAR(2000),
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_members" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" "ProviderMembershipLevel" NOT NULL,
    "status" "ProviderMembershipStatus" NOT NULL,
    "invited_by_user_id" TEXT,
    "enabled_at" TIMESTAMP(3) NOT NULL,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_admin_invitations" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "token_verifier" CHAR(64) NOT NULL,
    "token_version" INTEGER NOT NULL,
    "status" "ProviderInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "invited_by_user_id" TEXT NOT NULL,
    "accepted_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "delivery_failed_at" TIMESTAMP(3),
    "last_safe_delivery_error_code" VARCHAR(100),
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_admin_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_gallery_items" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "media_file_id" TEXT NOT NULL,
    "kind" "ProviderGalleryKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_gallery_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_email_outbox" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "template" "ProviderEmailTemplate" NOT NULL,
    "status" "ProviderEmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "recipient_user_id" TEXT NOT NULL,
    "review_cycle" INTEGER,
    "status_history_id" TEXT,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "last_safe_error_code" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_application_owner_user_id_key" ON "providers"("application_owner_user_id");

CREATE UNIQUE INDEX "providers_owner_user_id_key" ON "providers"("owner_user_id");

CREATE INDEX "providers_application_status_kind_last_submitted_at_id_idx" ON "providers"("application_status", "kind", "last_submitted_at", "id");

CREATE INDEX "providers_operational_status_id_idx" ON "providers"("operational_status", "id");

CREATE UNIQUE INDEX "provider_profiles_provider_id_key" ON "provider_profiles"("provider_id");

CREATE UNIQUE INDEX "provider_profiles_logo_media_file_id_key" ON "provider_profiles"("logo_media_file_id");

CREATE UNIQUE INDEX "provider_profiles_cover_media_file_id_key" ON "provider_profiles"("cover_media_file_id");

CREATE UNIQUE INDEX "provider_contacts_provider_id_key" ON "provider_contacts"("provider_id");

CREATE INDEX "provider_status_history_provider_id_created_at_idx" ON "provider_status_history"("provider_id", "created_at");

CREATE UNIQUE INDEX "provider_status_history_one_submission_per_cycle" ON "provider_status_history"("provider_id", "review_cycle") WHERE "domain" = 'APPLICATION' AND "to_application_status" = 'PENDING_REVIEW';

CREATE UNIQUE INDEX "provider_status_history_one_final_decision_per_cycle" ON "provider_status_history"("provider_id", "review_cycle") WHERE "domain" = 'APPLICATION' AND "to_application_status" IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

CREATE UNIQUE INDEX "provider_members_provider_id_user_id_key" ON "provider_members"("provider_id", "user_id");

CREATE UNIQUE INDEX "provider_members_one_owner_per_provider" ON "provider_members"("provider_id") WHERE "level" = 'OWNER';

CREATE INDEX "provider_members_user_id_status_idx" ON "provider_members"("user_id", "status");

CREATE INDEX "provider_members_provider_id_level_status_idx" ON "provider_members"("provider_id", "level", "status");

CREATE UNIQUE INDEX "provider_admin_invitations_token_verifier_key" ON "provider_admin_invitations"("token_verifier");

CREATE UNIQUE INDEX "provider_admin_invitations_one_pending_per_email" ON "provider_admin_invitations"("provider_id", "email_normalized") WHERE "status" = 'PENDING';

CREATE INDEX "provider_admin_invitations_provider_id_status_created_at_idx" ON "provider_admin_invitations"("provider_id", "status", "created_at");

CREATE INDEX "provider_admin_invitations_status_expires_at_idx" ON "provider_admin_invitations"("status", "expires_at");

CREATE UNIQUE INDEX "provider_gallery_items_media_file_id_key" ON "provider_gallery_items"("media_file_id");

CREATE UNIQUE INDEX "provider_gallery_items_provider_id_position_key" ON "provider_gallery_items"("provider_id", "position");

CREATE UNIQUE INDEX "provider_email_outbox_idempotency_key_key" ON "provider_email_outbox"("idempotency_key");

CREATE INDEX "provider_email_outbox_status_next_attempt_at_locked_until_idx" ON "provider_email_outbox"("status", "next_attempt_at", "locked_until");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_application_owner_user_id_fkey" FOREIGN KEY ("application_owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_logo_media_file_id_fkey" FOREIGN KEY ("logo_media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_cover_media_file_id_fkey" FOREIGN KEY ("cover_media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_contacts" ADD CONSTRAINT "provider_contacts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_status_history" ADD CONSTRAINT "provider_status_history_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_status_history" ADD CONSTRAINT "provider_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_admin_invitations" ADD CONSTRAINT "provider_admin_invitations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_admin_invitations" ADD CONSTRAINT "provider_admin_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_admin_invitations" ADD CONSTRAINT "provider_admin_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_gallery_items" ADD CONSTRAINT "provider_gallery_items_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_gallery_items" ADD CONSTRAINT "provider_gallery_items_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_gallery_items" ADD CONSTRAINT "provider_gallery_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_status_history_id_fkey" FOREIGN KEY ("status_history_id") REFERENCES "provider_status_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints not expressible in Prisma schema
ALTER TABLE "providers" ADD CONSTRAINT "providers_counters_check" CHECK ("version" > 0 AND "review_cycle" >= 0);

ALTER TABLE "providers" ADD CONSTRAINT "providers_approved_shape_check" CHECK (
  ("application_status" = 'APPROVED') = ("approved_at" IS NOT NULL)
);

ALTER TABLE "providers" ADD CONSTRAINT "providers_rejected_shape_check" CHECK (
  ("application_status" = 'REJECTED') = ("rejected_at" IS NOT NULL)
);

ALTER TABLE "providers" ADD CONSTRAINT "providers_suspended_shape_check" CHECK (
  ("operational_status" = 'SUSPENDED') = ("suspended_at" IS NOT NULL)
);

ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_on_approval_check" CHECK (
  (
    "application_status" = 'APPROVED'
    AND "owner_user_id" IS NOT NULL
  )
  OR (
    "application_status" <> 'APPROVED'
    AND "owner_user_id" IS NULL
  )
);

ALTER TABLE "provider_status_history" ADD CONSTRAINT "provider_status_history_domain_pair_check" CHECK (
  (
    "domain" = 'APPLICATION'
    AND "from_application_status" IS NOT NULL
    AND "to_application_status" IS NOT NULL
    AND "from_operational_status" IS NULL
    AND "to_operational_status" IS NULL
  )
  OR (
    "domain" = 'OPERATIONAL'
    AND "from_operational_status" IS NOT NULL
    AND "to_operational_status" IS NOT NULL
    AND "from_application_status" IS NULL
    AND "to_application_status" IS NULL
  )
);

ALTER TABLE "provider_status_history" ADD CONSTRAINT "provider_status_history_review_cycle_check" CHECK (
  "review_cycle" IS NULL OR "review_cycle" > 0
);

ALTER TABLE "provider_status_history" ADD CONSTRAINT "provider_status_history_submission_review_cycle_check" CHECK (
  "domain" <> 'APPLICATION'
  OR "to_application_status" NOT IN ('PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED')
  OR ("review_cycle" IS NOT NULL AND "review_cycle" > 0)
);

ALTER TABLE "provider_status_history" ADD CONSTRAINT "provider_status_history_reason_shape_check" CHECK (
  CASE
    WHEN "to_application_status" IN ('CHANGES_REQUESTED', 'REJECTED') THEN (
      "reason" IS NOT NULL AND length(btrim("reason")) > 0
    )
    WHEN "to_operational_status" = 'SUSPENDED' THEN (
      "reason" IS NOT NULL AND length(btrim("reason")) > 0
    )
    WHEN "domain" = 'OPERATIONAL'
      AND "from_operational_status" = 'SUSPENDED'
      AND "to_operational_status" = 'INACTIVE' THEN (
      "reason" IS NOT NULL AND length(btrim("reason")) > 0
    )
    ELSE true
  END
);

ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_owner_shape_check" CHECK (
  "level" <> 'OWNER'
  OR (
    "status" = 'ACTIVE'
    AND "invited_by_user_id" IS NULL
    AND "disabled_at" IS NULL
  )
);

ALTER TABLE "provider_members" ADD CONSTRAINT "provider_members_status_timestamps_check" CHECK (
  (
    "status" = 'ACTIVE'
    AND "disabled_at" IS NULL
  )
  OR (
    "status" = 'DISABLED'
    AND "disabled_at" IS NOT NULL
  )
);

ALTER TABLE "provider_admin_invitations" ADD CONSTRAINT "provider_admin_invitations_versions_check" CHECK (
  "token_version" > 0 AND "version" > 0
);

ALTER TABLE "provider_admin_invitations" ADD CONSTRAINT "provider_admin_invitations_status_shape_check" CHECK (
  (
    "status" = 'PENDING'
    AND "accepted_at" IS NULL
    AND "revoked_at" IS NULL
    AND "expired_at" IS NULL
    AND "accepted_by_user_id" IS NULL
  )
  OR (
    "status" = 'ACCEPTED'
    AND "accepted_at" IS NOT NULL
    AND "accepted_by_user_id" IS NOT NULL
    AND "revoked_at" IS NULL
    AND "expired_at" IS NULL
  )
  OR (
    "status" = 'REVOKED'
    AND "revoked_at" IS NOT NULL
    AND "accepted_at" IS NULL
    AND "expired_at" IS NULL
    AND "accepted_by_user_id" IS NULL
  )
  OR (
    "status" = 'EXPIRED'
    AND "expired_at" IS NOT NULL
    AND "accepted_at" IS NULL
    AND "revoked_at" IS NULL
    AND "accepted_by_user_id" IS NULL
  )
);

ALTER TABLE "provider_gallery_items" ADD CONSTRAINT "provider_gallery_items_position_check" CHECK (
  "position" >= 0
);

ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_attempt_count_check" CHECK (
  "attempt_count" >= 0
);

ALTER TABLE "provider_email_outbox" ADD CONSTRAINT "provider_email_outbox_review_cycle_check" CHECK (
  "review_cycle" IS NULL OR "review_cycle" > 0
);
