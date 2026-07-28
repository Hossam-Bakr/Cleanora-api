-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('INDIVIDUAL', 'COMPANY', 'ENGINEER', 'PROVIDER_OWNER', 'WORKER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "AuthenticationMethod" AS ENUM ('PASSWORD', 'GOOGLE');

-- CreateEnum
CREATE TYPE "SessionCapability" AS ENUM ('FULL', 'VERIFICATION_ONLY');

-- CreateEnum
CREATE TYPE "AuthDeliveryChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('CATEGORY_VERIFICATION', 'OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "AuthChallengeStatus" AS ENUM ('PENDING_DELIVERY', 'ACTIVE', 'CONSUMED', 'SUPERSEDED', 'EXHAUSTED', 'DELIVERY_FAILED');

-- CreateEnum
CREATE TYPE "PasswordResetPurpose" AS ENUM ('PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "SessionRevocationReason" AS ENUM ('LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'REFRESH_REUSE', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'SECURITY_FAILURE');

-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "AuthEventOutcome" AS ENUM ('SUCCEEDED', 'FAILED', 'DENIED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone_e164" VARCHAR(16),
    "email_normalized" VARCHAR(320),
    "account_categories" "AccountCategory"[] DEFAULT ARRAY[]::"AccountCategory"[],
    "verified_categories" "AccountCategory"[] DEFAULT ARRAY[]::"AccountCategory"[],
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspended_until" TIMESTAMP(3),
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone_verified_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "password_hash_version" INTEGER NOT NULL DEFAULT 1,
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "failure_window_started_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "last_authenticated_at" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_refresh_verifier" CHAR(64) NOT NULL,
    "verifier_key_version" INTEGER NOT NULL DEFAULT 1,
    "rotation_counter" INTEGER NOT NULL DEFAULT 0,
    "credential_version" INTEGER NOT NULL,
    "authentication_method" "AuthenticationMethod" NOT NULL,
    "capability" "SessionCapability" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" "SessionRevocationReason",
    "compromised_at" TIMESTAMP(3),
    "ip_hash" CHAR(64),
    "user_agent_hash" CHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_category" "AccountCategory" NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "AuthDeliveryChannel" NOT NULL,
    "destination_hash" CHAR(64) NOT NULL,
    "code_verifier" CHAR(64) NOT NULL,
    "verifier_key_version" INTEGER NOT NULL DEFAULT 1,
    "status" "AuthChallengeStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "resend_available_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "delivery_failed_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "PasswordResetPurpose" NOT NULL DEFAULT 'PASSWORD_RESET',
    "channel" "AuthDeliveryChannel" NOT NULL,
    "destination_hash" CHAR(64) NOT NULL,
    "token_verifier" CHAR(64) NOT NULL,
    "verifier_key_version" INTEGER NOT NULL DEFAULT 1,
    "status" "AuthChallengeStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "resend_available_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "delivery_failed_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "account_category" "AccountCategory" NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "provider_email_normalized" VARCHAR(320),
    "provider_email_verified_at" TIMESTAMP(3),
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_authenticated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "event_type" VARCHAR(64) NOT NULL,
    "outcome" "AuthEventOutcome" NOT NULL,
    "reason_code" VARCHAR(64),
    "request_id" TEXT,
    "identifier_hash" CHAR(64),
    "ip_hash" CHAR(64),
    "user_agent_hash" CHAR(64),
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_credentials_user_id_key" ON "user_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_current_refresh_verifier_key" ON "user_sessions"("current_refresh_verifier");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_revoked_at_idx" ON "user_sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_purpose_account_category_status_idx" ON "otp_codes"("user_id", "purpose", "account_category", "status");

-- CreateIndex
CREATE INDEX "otp_codes_status_expires_at_idx" ON "otp_codes"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_verifier_key" ON "password_reset_tokens"("token_verifier");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_status_idx" ON "password_reset_tokens"("user_id", "status");

-- CreateIndex
CREATE INDEX "password_reset_tokens_status_expires_at_idx" ON "password_reset_tokens"("status", "expires_at");

-- CreateIndex
CREATE INDEX "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_provider_subject_key" ON "social_accounts"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_user_id_provider_account_category_key" ON "social_accounts"("user_id", "provider", "account_category");

-- CreateIndex
CREATE INDEX "auth_events_created_at_idx" ON "auth_events"("created_at");

-- CreateIndex
CREATE INDEX "auth_events_user_id_created_at_idx" ON "auth_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "auth_events_event_type_created_at_idx" ON "auth_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "auth_events_request_id_idx" ON "auth_events"("request_id");

-- CreateIndex
CREATE INDEX "auth_events_session_id_idx" ON "auth_events"("session_id");

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Application invariants also live in PostgreSQL so concurrent writers cannot bypass them.
ALTER TABLE "users" ADD CONSTRAINT "users_categories_nonempty_check" CHECK (cardinality("account_categories") > 0);
ALTER TABLE "users" ADD CONSTRAINT "users_verified_categories_subset_check" CHECK ("verified_categories" <@ "account_categories");
ALTER TABLE "users" ADD CONSTRAINT "users_phone_e164_check" CHECK ("phone_e164" IS NULL OR "phone_e164" ~ '^\\+[1-9][0-9]{1,14}$');
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized_check" CHECK ("email_normalized" IS NULL OR "email_normalized" = lower(btrim("email_normalized")));
ALTER TABLE "users" ADD CONSTRAINT "users_suspension_check" CHECK (("status" = 'SUSPENDED') = ("suspended_until" IS NOT NULL));
ALTER TABLE "users" ADD CONSTRAINT "users_verified_individual_check" CHECK (NOT ('INDIVIDUAL' = ANY("verified_categories")) OR ("phone_e164" IS NOT NULL AND "phone_verified_at" IS NOT NULL));
ALTER TABLE "users" ADD CONSTRAINT "users_verified_business_check" CHECK (NOT ("verified_categories" && ARRAY['COMPANY','ENGINEER','PROVIDER_OWNER']::"AccountCategory"[]) OR ("email_normalized" IS NOT NULL AND "email_verified_at" IS NOT NULL));
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_counters_check" CHECK ("password_hash_version" > 0 AND "credential_version" > 0 AND "failed_login_attempts" >= 0);
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_versions_check" CHECK ("verifier_key_version" > 0 AND "rotation_counter" >= 0 AND "credential_version" > 0);
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_revocation_check" CHECK (("revoked_at" IS NULL) = ("revocation_reason" IS NULL));
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_compromise_check" CHECK ("compromised_at" IS NULL OR ("revoked_at" IS NOT NULL AND "revocation_reason" = 'REFRESH_REUSE'));
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_attempts_check" CHECK ("verifier_key_version" > 0 AND "max_attempts" > 0 AND "attempt_count" >= 0 AND "attempt_count" <= "max_attempts");
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_attempts_check" CHECK ("verifier_key_version" > 0 AND "max_attempts" > 0 AND "attempt_count" >= 0 AND "attempt_count" <= "max_attempts");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_expiry_check" CHECK ("expires_at" > "created_at");
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_r1_google_individual_check" CHECK ("provider" = 'GOOGLE' AND "account_category" = 'INDIVIDUAL');

CREATE UNIQUE INDEX "otp_codes_one_open_challenge_idx" ON "otp_codes"("user_id", "purpose", "account_category") WHERE "status" IN ('PENDING_DELIVERY', 'ACTIVE');
CREATE UNIQUE INDEX "password_reset_tokens_one_open_challenge_idx" ON "password_reset_tokens"("user_id", "purpose") WHERE "status" IN ('PENDING_DELIVERY', 'ACTIVE');
