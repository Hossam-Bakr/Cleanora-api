-- R1-P17 Worker & Team Assignment
-- Additive only. No wallets. No fee columns. No table drops.

ALTER TYPE "BookingStatus" ADD VALUE 'ASSIGNED';
ALTER TYPE "BookingNotificationTemplate" ADD VALUE 'BOOKING_ASSIGNED';
ALTER TYPE "BookingNotificationTemplate" ADD VALUE 'BOOKING_ASSIGNMENT_REPLACED';
ALTER TYPE "BookingActorCommandType" ADD VALUE 'ASSIGN_TEAM';
ALTER TYPE "BookingActorCommandType" ADD VALUE 'ASSIGN_WORKERS';
ALTER TYPE "BookingActorCommandType" ADD VALUE 'REPLACE_TEAM';
ALTER TYPE "BookingActorCommandType" ADD VALUE 'REPLACE_WORKERS';

CREATE TYPE "BookingAssignmentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');
CREATE TYPE "BookingAssignmentSource" AS ENUM ('TEAM', 'WORKERS');
CREATE TYPE "BookingAssignmentHistoryEvent" AS ENUM ('CREATED', 'REPLACED', 'SUPERSEDED');

CREATE TABLE "booking_assignments" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "status" "BookingAssignmentStatus" NOT NULL,
  "source" "BookingAssignmentSource" NOT NULL,
  "team_id" TEXT,
  "team_version" INTEGER,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "assigned_by_user_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "superseded_at" TIMESTAMP(3),
  CONSTRAINT "booking_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_assignments_booking_id_status_idx"
  ON "booking_assignments"("booking_id", "status");
CREATE INDEX "booking_assignments_provider_id_status_starts_at_ends_at_idx"
  ON "booking_assignments"("provider_id", "status", "starts_at", "ends_at");
CREATE INDEX "booking_assignments_status_starts_at_ends_at_idx"
  ON "booking_assignments"("status", "starts_at", "ends_at");
CREATE UNIQUE INDEX "booking_assignments_one_active_per_booking_idx"
  ON "booking_assignments"("booking_id")
  WHERE "status" = 'ACTIVE';

CREATE TABLE "booking_assignment_members" (
  "id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "worker_user_id" TEXT,
  "worker_type" VARCHAR(40) NOT NULL,
  "gender" VARCHAR(40) NOT NULL,
  "cleans" BOOLEAN NOT NULL,
  "display_name_en" VARCHAR(200) NOT NULL,
  "display_name_ar" VARCHAR(200) NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_assignment_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_assignment_members_assignment_id_worker_id_key"
  ON "booking_assignment_members"("assignment_id", "worker_id");
CREATE INDEX "booking_assignment_members_worker_id_assignment_id_idx"
  ON "booking_assignment_members"("worker_id", "assignment_id");
CREATE INDEX "booking_assignment_members_worker_user_id_assignment_id_idx"
  ON "booking_assignment_members"("worker_user_id", "assignment_id");

CREATE TABLE "booking_assignment_history" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "event" "BookingAssignmentHistoryEvent" NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason_code" VARCHAR(100) NOT NULL,
  "reason_text" VARCHAR(1000),
  "safe_before" JSONB,
  "safe_after" JSONB NOT NULL,
  "request_id" VARCHAR(200) NOT NULL,
  "operation_key" VARCHAR(240) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_assignment_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_assignment_history_operation_key_key"
  ON "booking_assignment_history"("operation_key");
CREATE INDEX "booking_assignment_history_booking_id_created_at_idx"
  ON "booking_assignment_history"("booking_id", "created_at");
CREATE INDEX "booking_assignment_history_assignment_id_created_at_idx"
  ON "booking_assignment_history"("assignment_id", "created_at");

ALTER TABLE "booking_assignments"
  ADD CONSTRAINT "booking_assignments_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_assignments"
  ADD CONSTRAINT "booking_assignments_assigned_by_user_id_fkey"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_assignment_members"
  ADD CONSTRAINT "booking_assignment_members_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "booking_assignments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_assignment_history"
  ADD CONSTRAINT "booking_assignment_history_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_assignment_history"
  ADD CONSTRAINT "booking_assignment_history_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "booking_assignments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_assignment_history"
  ADD CONSTRAINT "booking_assignment_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "status_transition_rules"
  ("id", "actor", "from_status", "to_status", "category", "executable",
   "preconditions_json", "side_effects_json", "audit_json", "failure_json")
VALUES
  (
    'str_prov_accepted_assigned',
    'PROVIDER',
    'ACCEPTED',
    'ASSIGNED',
    'NORMAL',
    true,
    '{"requiresActiveAssignmentWrite":true}'::jsonb,
    '{"createsAssignment":true,"notificationTemplates":["BOOKING_ASSIGNED"]}'::jsonb,
    '{"required":true}'::jsonb,
    '{"stableCode":"BOOKING_ASSIGNMENT_INVALID_STATE"}'::jsonb
  ),
  (
    'str_cust_assigned_cancelled',
    'CUSTOMER',
    'ASSIGNED',
    'CANCELLED',
    'CANCELLATION',
    true,
    '{"requiresCancellationRecord":true}'::jsonb,
    '{"recordsCancellation":true,"notificationTemplates":["BOOKING_CANCELLED"]}'::jsonb,
    '{"required":true}'::jsonb,
    '{"stableCode":"BOOKING_CANCEL_INVALID_STATE"}'::jsonb
  ),
  (
    'str_prov_assigned_cancelled',
    'PROVIDER',
    'ASSIGNED',
    'CANCELLED',
    'CANCELLATION',
    true,
    '{"requiresCancellationRecord":true}'::jsonb,
    '{"recordsCancellation":true,"notificationTemplates":["BOOKING_CANCELLED"]}'::jsonb,
    '{"required":true}'::jsonb,
    '{"stableCode":"BOOKING_CANCEL_INVALID_STATE"}'::jsonb
  ),
  (
    'str_staff_assigned_cancelled',
    'STAFF_ADMIN',
    'ASSIGNED',
    'CANCELLED',
    'PRIVILEGED_OVERRIDE',
    true,
    '{"requiresCancellationRecord":true,"requiresStaffAdmin":true}'::jsonb,
    '{"recordsCancellation":true,"notificationTemplates":["BOOKING_CANCELLED"]}'::jsonb,
    '{"required":true,"privileged":true}'::jsonb,
    '{"stableCode":"BOOKING_CANCEL_INVALID_STATE"}'::jsonb
  );
