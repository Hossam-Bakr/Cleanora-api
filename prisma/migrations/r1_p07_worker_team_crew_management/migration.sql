-- R1-P07 Worker, Team & Crew Management.
-- Forward-only, additive migration. Existing workforce data is intentionally not inferred.

CREATE TYPE "WorkerOperationalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'REMOVED');
CREATE TYPE "WorkerGender" AS ENUM ('MALE', 'FEMALE');
CREATE TYPE "WorkerType" AS ENUM ('CLEANING_STAFF', 'ESCORT', 'OTHER');
CREATE TYPE "WorkerLoginAccessStatus" AS ENUM ('INVITED', 'ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "WorkerInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', 'SUPERSEDED');
CREATE TYPE "ProviderTeamStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ProviderWorkforceTargetType" AS ENUM (
  'WORKER', 'WORKER_PROFILE', 'LOGIN_ACCESS', 'INVITATION', 'ADMIN_MEMBERSHIP',
  'TEAM', 'TEAM_MEMBERSHIP', 'PRIMARY_SUPERVISOR', 'READINESS'
);
CREATE TYPE "ProviderWorkforceNotificationTemplate" AS ENUM (
  'INVITATION_ISSUED', 'LOGIN_ACCESS_ACTIVATED', 'LOGIN_ACCESS_RESET', 'LOGIN_ACCESS_REVOKED',
  'WORKER_ACTIVATED', 'WORKER_DEACTIVATED', 'WORKER_REMOVED', 'WORKER_DEPARTED',
  'PROVIDER_ADMIN_GRANTED', 'PROVIDER_ADMIN_REVOKED'
);
CREATE TYPE "ProviderWorkforceNotificationStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "ProviderWorkforceCommandStatus" AS ENUM ('IN_PROGRESS', 'ACCEPTED');

ALTER TYPE "MediaOwnerType" ADD VALUE 'WORKER_PROFILE_IMAGE';
ALTER TYPE "OtpPurpose" ADD VALUE 'WORKER_INVITATION_EMAIL_VERIFICATION';

ALTER TABLE "providers"
  ADD COLUMN "workforce_state_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "provider_members"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "providers"
  ADD CONSTRAINT "providers_workforce_state_version_positive_check"
  CHECK ("workforce_state_version" > 0);
ALTER TABLE "provider_members"
  ADD CONSTRAINT "provider_members_version_positive_check"
  CHECK ("version" > 0);

CREATE TABLE "provider_workers" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "identity_user_id" TEXT,
  "predecessor_worker_id" TEXT,
  "status" "WorkerOperationalStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "accepted_invitation_locale" "PreferredLanguage",
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_workers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_workers_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "provider_workers_terminal_shape_check" CHECK (
    ("status" = 'REMOVED' AND "ended_at" IS NOT NULL)
    OR ("status" <> 'REMOVED' AND "ended_at" IS NULL)
  ),
  CONSTRAINT "provider_workers_predecessor_not_self_check" CHECK (
    "predecessor_worker_id" IS NULL OR "predecessor_worker_id" <> "id"
  )
);

CREATE TABLE "provider_worker_profiles" (
  "worker_id" TEXT NOT NULL,
  "full_legal_name" VARCHAR(200) NOT NULL,
  "gender" "WorkerGender" NOT NULL,
  "operational_phone_e164" VARCHAR(16) NOT NULL,
  "worker_type" "WorkerType" NOT NULL,
  "display_title" VARCHAR(120),
  "supervisor_capable" BOOLEAN NOT NULL DEFAULT false,
  "avatar_media_file_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_worker_profiles_pkey" PRIMARY KEY ("worker_id"),
  CONSTRAINT "provider_worker_profiles_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "provider_worker_profiles_name_check" CHECK (char_length(btrim("full_legal_name")) > 0),
  CONSTRAINT "provider_worker_profiles_phone_check" CHECK ("operational_phone_e164" ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT "provider_worker_profiles_title_check" CHECK ("display_title" IS NULL OR char_length(btrim("display_title")) > 0)
);

CREATE TABLE "provider_worker_skills" (
  "id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "display_label" VARCHAR(100) NOT NULL,
  "normalized_label" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_worker_skills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_worker_skills_labels_check" CHECK (
    char_length(btrim("display_label")) > 0 AND char_length(btrim("normalized_label")) > 0
  )
);

CREATE TABLE "provider_worker_invitations" (
  "id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "invitation_version" INTEGER NOT NULL,
  "email_normalized" VARCHAR(320) NOT NULL,
  "locale" "PreferredLanguage" NOT NULL,
  "status" "WorkerInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "issued_by_user_id" TEXT NOT NULL,
  "accepted_by_user_id" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_worker_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_worker_invitations_versions_positive_check" CHECK ("invitation_version" > 0 AND "version" > 0),
  CONSTRAINT "provider_worker_invitations_expiry_check" CHECK ("expires_at" = "issued_at" + INTERVAL '72 hours'),
  CONSTRAINT "provider_worker_invitations_status_shape_check" CHECK (
    ("status" = 'PENDING' AND "accepted_at" IS NULL AND "revoked_at" IS NULL AND "expired_at" IS NULL AND "superseded_at" IS NULL)
    OR ("status" = 'ACCEPTED' AND "accepted_at" IS NOT NULL AND "accepted_by_user_id" IS NOT NULL AND "revoked_at" IS NULL AND "expired_at" IS NULL AND "superseded_at" IS NULL)
    OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "accepted_at" IS NULL AND "expired_at" IS NULL AND "superseded_at" IS NULL)
    OR ("status" = 'EXPIRED' AND "expired_at" IS NOT NULL AND "accepted_at" IS NULL AND "revoked_at" IS NULL AND "superseded_at" IS NULL)
    OR ("status" = 'SUPERSEDED' AND "superseded_at" IS NOT NULL AND "accepted_at" IS NULL AND "revoked_at" IS NULL AND "expired_at" IS NULL)
  )
);

CREATE TABLE "provider_worker_login_access" (
  "worker_id" TEXT NOT NULL,
  "status" "WorkerLoginAccessStatus" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "current_invitation_id" TEXT,
  "activated_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_worker_login_access_pkey" PRIMARY KEY ("worker_id"),
  CONSTRAINT "provider_worker_login_access_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "provider_worker_login_access_shape_check" CHECK (
    ("status" = 'INVITED' AND "current_invitation_id" IS NOT NULL AND "activated_at" IS NULL AND "revoked_at" IS NULL)
    OR ("status" = 'ACTIVE' AND "activated_at" IS NOT NULL AND "revoked_at" IS NULL)
    OR ("status" = 'EXPIRED' AND "current_invitation_id" IS NOT NULL AND "revoked_at" IS NULL)
    OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL)
  )
);

CREATE TABLE "provider_teams" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "name" VARCHAR(200),
  "normalized_name" VARCHAR(200),
  "status" "ProviderTeamStatus" NOT NULL DEFAULT 'DRAFT',
  "primary_supervisor_worker_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_teams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_teams_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "provider_teams_name_pair_check" CHECK (
    ("name" IS NULL AND "normalized_name" IS NULL)
    OR (char_length(btrim("name")) > 0 AND char_length(btrim("normalized_name")) > 0)
  )
);

CREATE TABLE "provider_team_memberships" (
  "id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "cleans" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_team_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_team_memberships_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "provider_team_memberships_time_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
);

CREATE TABLE "provider_workforce_history" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "target_type" "ProviderWorkforceTargetType" NOT NULL,
  "target_id" TEXT NOT NULL,
  "target_version" INTEGER NOT NULL,
  "event_code" VARCHAR(100) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason_code" VARCHAR(100),
  "note" VARCHAR(1000),
  "safe_before" JSONB,
  "safe_after" JSONB,
  "request_id" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_workforce_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_workforce_history_target_version_positive_check" CHECK ("target_version" > 0),
  CONSTRAINT "provider_workforce_history_event_code_check" CHECK (char_length(btrim("event_code")) > 0)
);

CREATE TABLE "provider_workforce_commands" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "scope_key" VARCHAR(240) NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "status" "ProviderWorkforceCommandStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "safe_result_code" VARCHAR(100),
  "safe_result_json" JSONB,
  "actor_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "provider_workforce_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_workforce_commands_fingerprint_check" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "provider_workforce_commands_status_shape_check" CHECK (
    ("status" = 'IN_PROGRESS' AND "completed_at" IS NULL)
    OR ("status" = 'ACCEPTED' AND "completed_at" IS NOT NULL AND "safe_result_code" IS NOT NULL)
  )
);

CREATE TABLE "provider_workforce_notification_intents" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "template" "ProviderWorkforceNotificationTemplate" NOT NULL,
  "locale" "PreferredLanguage" NOT NULL,
  "recipient_user_id" TEXT,
  "recipient_email_normalized" VARCHAR(320),
  "invitation_id" TEXT,
  "history_id" TEXT,
  "safe_variables" JSONB NOT NULL DEFAULT '{}',
  "idempotency_key" VARCHAR(240) NOT NULL,
  "status" "ProviderWorkforceNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3),
  "locked_until" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "last_safe_error_code" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_workforce_notification_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_workforce_notification_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "provider_workforce_notification_recipient_check" CHECK (
    ("recipient_user_id" IS NOT NULL AND "recipient_email_normalized" IS NULL)
    OR ("recipient_user_id" IS NULL AND "recipient_email_normalized" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "provider_workers_predecessor_worker_id_key" ON "provider_workers"("predecessor_worker_id");
CREATE UNIQUE INDEX "provider_workers_current_identity_unique" ON "provider_workers"("identity_user_id")
  WHERE "identity_user_id" IS NOT NULL AND "ended_at" IS NULL;
CREATE INDEX "provider_workers_provider_status_id_idx" ON "provider_workers"("provider_id", "status", "id");
CREATE INDEX "provider_workers_provider_updated_id_idx" ON "provider_workers"("provider_id", "updated_at", "id");

CREATE UNIQUE INDEX "provider_worker_profiles_avatar_media_file_id_key" ON "provider_worker_profiles"("avatar_media_file_id");
CREATE INDEX "provider_worker_profiles_type_supervisor_idx" ON "provider_worker_profiles"("worker_type", "supervisor_capable");
CREATE UNIQUE INDEX "provider_worker_skills_worker_normalized_unique" ON "provider_worker_skills"("worker_id", "normalized_label");
CREATE UNIQUE INDEX "provider_worker_invitations_worker_version_unique" ON "provider_worker_invitations"("worker_id", "invitation_version");
CREATE UNIQUE INDEX "provider_worker_invitations_pending_unique" ON "provider_worker_invitations"("worker_id") WHERE "status" = 'PENDING';
CREATE INDEX "provider_worker_invitations_worker_status_version_idx" ON "provider_worker_invitations"("worker_id", "status", "invitation_version");
CREATE INDEX "provider_worker_invitations_status_expiry_idx" ON "provider_worker_invitations"("status", "expires_at");
CREATE UNIQUE INDEX "provider_worker_login_access_current_invitation_id_key" ON "provider_worker_login_access"("current_invitation_id");

CREATE UNIQUE INDEX "provider_teams_non_archived_name_unique" ON "provider_teams"("provider_id", "normalized_name")
  WHERE "status" <> 'ARCHIVED' AND "normalized_name" IS NOT NULL;
CREATE INDEX "provider_teams_provider_status_id_idx" ON "provider_teams"("provider_id", "status", "id");
CREATE UNIQUE INDEX "provider_team_memberships_team_worker_started_unique" ON "provider_team_memberships"("team_id", "worker_id", "started_at");
CREATE UNIQUE INDEX "provider_team_memberships_current_worker_unique" ON "provider_team_memberships"("worker_id") WHERE "ended_at" IS NULL;
CREATE INDEX "provider_team_memberships_team_ended_id_idx" ON "provider_team_memberships"("team_id", "ended_at", "id");

CREATE INDEX "provider_workforce_history_target_idx" ON "provider_workforce_history"("provider_id", "target_type", "target_id", "created_at", "id");
CREATE INDEX "provider_workforce_history_actor_idx" ON "provider_workforce_history"("actor_user_id", "created_at");
CREATE UNIQUE INDEX "provider_workforce_commands_scope_idempotency_unique" ON "provider_workforce_commands"("scope_key", "idempotency_key");
CREATE INDEX "provider_workforce_commands_provider_created_idx" ON "provider_workforce_commands"("provider_id", "created_at");
CREATE UNIQUE INDEX "provider_workforce_notification_idempotency_key" ON "provider_workforce_notification_intents"("idempotency_key");
CREATE INDEX "provider_workforce_notification_lease_idx" ON "provider_workforce_notification_intents"("status", "next_attempt_at", "locked_until");
CREATE INDEX "provider_workforce_notification_provider_created_idx" ON "provider_workforce_notification_intents"("provider_id", "created_at");

ALTER TABLE "provider_workers" ADD CONSTRAINT "provider_workers_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workers" ADD CONSTRAINT "provider_workers_identity_user_id_fkey"
  FOREIGN KEY ("identity_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workers" ADD CONSTRAINT "provider_workers_predecessor_worker_id_fkey"
  FOREIGN KEY ("predecessor_worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_profiles" ADD CONSTRAINT "provider_worker_profiles_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_profiles" ADD CONSTRAINT "provider_worker_profiles_avatar_media_file_id_fkey"
  FOREIGN KEY ("avatar_media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_skills" ADD CONSTRAINT "provider_worker_skills_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_invitations" ADD CONSTRAINT "provider_worker_invitations_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_invitations" ADD CONSTRAINT "provider_worker_invitations_issued_by_user_id_fkey"
  FOREIGN KEY ("issued_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_invitations" ADD CONSTRAINT "provider_worker_invitations_accepted_by_user_id_fkey"
  FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_login_access" ADD CONSTRAINT "provider_worker_login_access_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_worker_login_access" ADD CONSTRAINT "provider_worker_login_access_current_invitation_id_fkey"
  FOREIGN KEY ("current_invitation_id") REFERENCES "provider_worker_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_teams" ADD CONSTRAINT "provider_teams_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_teams" ADD CONSTRAINT "provider_teams_primary_supervisor_worker_id_fkey"
  FOREIGN KEY ("primary_supervisor_worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_team_memberships" ADD CONSTRAINT "provider_team_memberships_team_id_fkey"
  FOREIGN KEY ("team_id") REFERENCES "provider_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_team_memberships" ADD CONSTRAINT "provider_team_memberships_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_history" ADD CONSTRAINT "provider_workforce_history_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_history" ADD CONSTRAINT "provider_workforce_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_commands" ADD CONSTRAINT "provider_workforce_commands_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_commands" ADD CONSTRAINT "provider_workforce_commands_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_notification_intents" ADD CONSTRAINT "provider_workforce_notification_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_notification_intents" ADD CONSTRAINT "provider_workforce_notification_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_notification_intents" ADD CONSTRAINT "provider_workforce_notification_invitation_id_fkey"
  FOREIGN KEY ("invitation_id") REFERENCES "provider_worker_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_workforce_notification_intents" ADD CONSTRAINT "provider_workforce_notification_history_id_fkey"
  FOREIGN KEY ("history_id") REFERENCES "provider_workforce_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-row Provider/Worker/Team constraints are deferred so valid atomic repair
-- orderings can finish before the invariant is evaluated.
CREATE FUNCTION "r1_p07_check_worker_predecessor"() RETURNS TRIGGER AS $$
DECLARE predecessor_row "provider_workers"%ROWTYPE; predecessor_cycle BOOLEAN;
BEGIN
  IF NEW."predecessor_worker_id" IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO predecessor_row FROM "provider_workers" WHERE "id" = NEW."predecessor_worker_id";
  IF predecessor_row."status" <> 'REMOVED'
     OR predecessor_row."provider_id" <> NEW."provider_id"
     OR predecessor_row."identity_user_id" IS NULL
     OR NEW."identity_user_id" IS NULL
     OR predecessor_row."identity_user_id" IS DISTINCT FROM NEW."identity_user_id" THEN
    RAISE EXCEPTION 'provider_workers_predecessor_invalid' USING ERRCODE = '23514', CONSTRAINT = 'provider_workers_predecessor_valid';
  END IF;
  WITH RECURSIVE predecessor_chain AS (
    SELECT w."id", w."predecessor_worker_id"
      FROM "provider_workers" w WHERE w."id" = NEW."predecessor_worker_id"
    UNION
    SELECT w."id", w."predecessor_worker_id"
      FROM "provider_workers" w
      JOIN predecessor_chain chain ON w."id" = chain."predecessor_worker_id"
  )
  SELECT EXISTS (SELECT 1 FROM predecessor_chain WHERE "id" = NEW."id")
    INTO predecessor_cycle;
  IF predecessor_cycle THEN
    RAISE EXCEPTION 'provider_workers_predecessor_cycle' USING ERRCODE = '23514', CONSTRAINT = 'provider_workers_predecessor_valid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "provider_workers_predecessor_valid"
AFTER INSERT OR UPDATE OF "predecessor_worker_id", "provider_id", "identity_user_id" ON "provider_workers"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_check_worker_predecessor"();

CREATE FUNCTION "r1_p07_check_worker_profile_exists"() RETURNS TRIGGER AS $$
DECLARE worker_key TEXT;
BEGIN
  IF TG_TABLE_NAME = 'provider_workers' THEN
    worker_key := NEW."id";
  ELSE
    worker_key := OLD."worker_id";
  END IF;
  IF EXISTS (SELECT 1 FROM "provider_workers" WHERE "id" = worker_key)
     AND NOT EXISTS (SELECT 1 FROM "provider_worker_profiles" WHERE "worker_id" = worker_key) THEN
    RAISE EXCEPTION 'provider_worker_profile_missing' USING ERRCODE = '23514', CONSTRAINT = 'provider_workers_profile_required';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "provider_workers_profile_required"
AFTER INSERT OR UPDATE OF "id" ON "provider_workers"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_check_worker_profile_exists"();

CREATE CONSTRAINT TRIGGER "provider_worker_profiles_delete_rechecks_required"
AFTER DELETE ON "provider_worker_profiles"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_check_worker_profile_exists"();

CREATE FUNCTION "r1_p07_check_login_access_invitation"() RETURNS TRIGGER AS $$
DECLARE invitation_worker_id TEXT;
BEGIN
  IF NEW."current_invitation_id" IS NULL THEN RETURN NEW; END IF;
  SELECT "worker_id" INTO invitation_worker_id
    FROM "provider_worker_invitations" WHERE "id" = NEW."current_invitation_id";
  IF invitation_worker_id IS DISTINCT FROM NEW."worker_id" THEN
    RAISE EXCEPTION 'provider_worker_login_access_invitation_mismatch' USING ERRCODE = '23514', CONSTRAINT = 'provider_worker_login_access_invitation_same_worker';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "provider_worker_login_access_invitation_same_worker"
AFTER INSERT OR UPDATE OF "worker_id", "current_invitation_id" ON "provider_worker_login_access"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_check_login_access_invitation"();

CREATE FUNCTION "r1_p07_check_membership"() RETURNS TRIGGER AS $$
DECLARE team_provider TEXT; worker_provider TEXT; worker_kind "WorkerType";
BEGIN
  SELECT "provider_id" INTO team_provider FROM "provider_teams" WHERE "id" = NEW."team_id";
  SELECT w."provider_id", p."worker_type" INTO worker_provider, worker_kind
    FROM "provider_workers" w JOIN "provider_worker_profiles" p ON p."worker_id" = w."id"
    WHERE w."id" = NEW."worker_id";
  IF team_provider IS DISTINCT FROM worker_provider THEN
    RAISE EXCEPTION 'provider_team_membership_provider_mismatch' USING ERRCODE = '23514', CONSTRAINT = 'provider_team_memberships_same_provider';
  END IF;
  IF worker_kind = 'ESCORT' AND NEW."cleans" THEN
    RAISE EXCEPTION 'provider_team_membership_escort_cleans' USING ERRCODE = '23514', CONSTRAINT = 'provider_team_memberships_escort_never_cleans';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "provider_team_memberships_same_provider_and_escort"
AFTER INSERT OR UPDATE OF "team_id", "worker_id", "cleans", "ended_at" ON "provider_team_memberships"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_check_membership"();

CREATE FUNCTION "r1_p07_check_team"() RETURNS TRIGGER AS $$
DECLARE supervisor_valid BOOLEAN; cleaner_count INTEGER;
BEGIN
  IF NEW."primary_supervisor_worker_id" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "provider_workers" w
      JOIN "provider_worker_profiles" p ON p."worker_id" = w."id"
      JOIN "provider_team_memberships" m ON m."worker_id" = w."id"
      WHERE w."id" = NEW."primary_supervisor_worker_id"
        AND w."provider_id" = NEW."provider_id" AND w."status" = 'ACTIVE'
        AND p."supervisor_capable" AND m."team_id" = NEW."id" AND m."ended_at" IS NULL
    ) INTO supervisor_valid;
    IF NOT supervisor_valid THEN
      RAISE EXCEPTION 'provider_team_primary_supervisor_invalid' USING ERRCODE = '23514', CONSTRAINT = 'provider_teams_primary_supervisor_valid';
    END IF;
  END IF;
  IF NEW."status" = 'ACTIVE' THEN
    IF NEW."normalized_name" IS NULL THEN
      RAISE EXCEPTION 'provider_team_active_name_missing' USING ERRCODE = '23514', CONSTRAINT = 'provider_teams_active_valid';
    END IF;
    SELECT count(*) INTO cleaner_count
      FROM "provider_team_memberships" m
      JOIN "provider_workers" w ON w."id" = m."worker_id"
      JOIN "provider_worker_profiles" p ON p."worker_id" = w."id"
      WHERE m."team_id" = NEW."id" AND m."ended_at" IS NULL AND m."cleans"
        AND w."status" = 'ACTIVE' AND p."worker_type" = 'CLEANING_STAFF';
    IF cleaner_count < 1 THEN
      RAISE EXCEPTION 'provider_team_active_cleaner_missing' USING ERRCODE = '23514', CONSTRAINT = 'provider_teams_active_valid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "provider_teams_invariants"
AFTER INSERT OR UPDATE OF "provider_id", "status", "normalized_name", "primary_supervisor_worker_id" ON "provider_teams"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_check_team"();

CREATE FUNCTION "r1_p07_check_team_row"(team_key TEXT) RETURNS VOID AS $$
DECLARE team_row "provider_teams"%ROWTYPE; supervisor_valid BOOLEAN; cleaner_count INTEGER;
BEGIN
  SELECT * INTO team_row FROM "provider_teams" WHERE "id" = team_key;
  IF NOT FOUND THEN RETURN; END IF;
  IF team_row."primary_supervisor_worker_id" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "provider_workers" w
      JOIN "provider_worker_profiles" p ON p."worker_id" = w."id"
      JOIN "provider_team_memberships" m ON m."worker_id" = w."id"
      WHERE w."id" = team_row."primary_supervisor_worker_id"
        AND w."provider_id" = team_row."provider_id" AND w."status" = 'ACTIVE'
        AND p."supervisor_capable" AND m."team_id" = team_row."id" AND m."ended_at" IS NULL
    ) INTO supervisor_valid;
    IF NOT supervisor_valid THEN
      RAISE EXCEPTION 'provider_team_primary_supervisor_invalid' USING ERRCODE = '23514', CONSTRAINT = 'provider_teams_primary_supervisor_valid';
    END IF;
  END IF;
  IF team_row."status" = 'ACTIVE' THEN
    IF team_row."normalized_name" IS NULL THEN
      RAISE EXCEPTION 'provider_team_active_name_missing' USING ERRCODE = '23514', CONSTRAINT = 'provider_teams_active_valid';
    END IF;
    SELECT count(*) INTO cleaner_count FROM "provider_team_memberships" m
      JOIN "provider_workers" w ON w."id" = m."worker_id"
      JOIN "provider_worker_profiles" p ON p."worker_id" = w."id"
      WHERE m."team_id" = team_row."id" AND m."ended_at" IS NULL AND m."cleans"
        AND w."status" = 'ACTIVE' AND p."worker_type" = 'CLEANING_STAFF';
    IF cleaner_count < 1 THEN
      RAISE EXCEPTION 'provider_team_active_cleaner_missing' USING ERRCODE = '23514', CONSTRAINT = 'provider_teams_active_valid';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "r1_p07_recheck_affected_teams"() RETURNS TRIGGER AS $$
DECLARE team_row "provider_teams"%ROWTYPE; affected_worker_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'provider_team_memberships' THEN
    IF TG_OP <> 'INSERT' THEN
      PERFORM "r1_p07_check_team_row"(OLD."team_id");
    END IF;
    IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."team_id" IS DISTINCT FROM OLD."team_id") THEN
      PERFORM "r1_p07_check_team_row"(NEW."team_id");
    END IF;
    RETURN COALESCE(NEW, OLD);
  ELSIF TG_TABLE_NAME = 'provider_worker_profiles' THEN
    affected_worker_id := COALESCE(NEW."worker_id", OLD."worker_id");
    IF TG_OP <> 'DELETE' AND NEW."worker_type" = 'ESCORT'
       AND EXISTS (
         SELECT 1 FROM "provider_team_memberships"
         WHERE "worker_id" = NEW."worker_id" AND "ended_at" IS NULL AND "cleans"
       ) THEN
      RAISE EXCEPTION 'provider_team_membership_escort_cleans' USING ERRCODE = '23514', CONSTRAINT = 'provider_team_memberships_escort_never_cleans';
    END IF;
  ELSE
    affected_worker_id := COALESCE(NEW."id", OLD."id");
  END IF;
  FOR team_row IN
    SELECT DISTINCT t.* FROM "provider_teams" t
    LEFT JOIN "provider_team_memberships" m ON m."team_id" = t."id"
    WHERE m."worker_id" = affected_worker_id
       OR t."primary_supervisor_worker_id" = affected_worker_id
  LOOP
    PERFORM "r1_p07_check_team_row"(team_row."id");
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "provider_team_memberships_recheck_team"
AFTER INSERT OR UPDATE OR DELETE ON "provider_team_memberships"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_recheck_affected_teams"();

CREATE CONSTRAINT TRIGGER "provider_workers_recheck_team"
AFTER UPDATE OF "status" ON "provider_workers"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_recheck_affected_teams"();

CREATE CONSTRAINT TRIGGER "provider_worker_profiles_recheck_team"
AFTER INSERT OR UPDATE OR DELETE ON "provider_worker_profiles"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "r1_p07_recheck_affected_teams"();

-- Ordinary application roles cannot mutate the append-only history ledger. A
-- privileged PostgreSQL administrator can use the standard trigger-disable or
-- replication-role mechanism for a documented repair; application code has no
-- such capability and exposes no update/delete repository method.
CREATE FUNCTION "r1_p07_reject_workforce_history_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'provider_workforce_history_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_workforce_history_immutable"
BEFORE UPDATE OR DELETE ON "provider_workforce_history"
FOR EACH ROW EXECUTE FUNCTION "r1_p07_reject_workforce_history_mutation"();
