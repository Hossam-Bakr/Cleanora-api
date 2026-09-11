-- R1-P13 Booking Draft, Pricing Snapshot & Status Machine (DEC-090).
-- Forward-only, additive after r1_p11_eligibility_engine_v1.
-- No Country/Provider/Catalog production truth rows are deleted.
-- Snapshots and price breakdowns have created_at only (immutable).

ALTER TYPE "MediaOwnerType" ADD VALUE 'BOOKING_ATTACHMENT';

CREATE TYPE "BookingStatus" AS ENUM (
  'DRAFT',
  'AWAITING_DEPOSIT',
  'CONFIRMED',
  'CANCELLED'
);
CREATE TYPE "BookingPath" AS ENUM ('BROWSE');
CREATE TYPE "BookingCrewPreference" AS ENUM ('ALL_MALE', 'ALL_FEMALE', 'ANY');
CREATE TYPE "BookingCommandType" AS ENUM (
  'CREATE',
  'SUBMIT_FOR_DEPOSIT',
  'CANCEL',
  'ATTACH_MEDIA'
);
CREATE TYPE "BookingCancelReason" AS ENUM (
  'CUSTOMER_CHANGED_MIND',
  'CUSTOMER_WRONG_DETAILS',
  'OTHER'
);
CREATE TYPE "StatusTransitionActor" AS ENUM ('CUSTOMER', 'SYSTEM', 'STAFF_ADMIN');
CREATE TYPE "StatusTransitionCategory" AS ENUM (
  'NORMAL',
  'CANCELLATION',
  'FAILURE',
  'PRIVILEGED_OVERRIDE',
  'COMPLETION',
  'EMERGENCY_RELATED'
);

CREATE TABLE "bookings" (
  "id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "status" "BookingStatus" NOT NULL,
  "path" "BookingPath" NOT NULL DEFAULT 'BROWSE',
  "service_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "team_id" TEXT NOT NULL,
  "city_id" TEXT NOT NULL,
  "district_id" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "crew_preference" "BookingCrewPreference" NOT NULL,
  "required_team_units" INTEGER NOT NULL,
  "locale" "PreferredLanguage" NOT NULL,
  "notes" VARCHAR(2000),
  "emergency_signaled" BOOLEAN NOT NULL DEFAULT false,
  "gross_minor_units" DECIMAL(65,0),
  "deposit_minor_units" DECIMAL(65,0),
  "remainder_minor_units" DECIMAL(65,0),
  "deposit_percent" VARCHAR(16) NOT NULL,
  "eligibility_evaluation_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "submitted_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_required_team_units_check" CHECK ("required_team_units" BETWEEN 1 AND 50),
  CONSTRAINT "bookings_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "bookings_interval_check" CHECK ("ends_at" > "starts_at")
);

CREATE INDEX "bookings_customer_user_id_created_at_idx" ON "bookings"("customer_user_id", "created_at");
CREATE INDEX "bookings_status_created_at_idx" ON "bookings"("status", "created_at");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_customer_user_id_fkey"
  FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_items" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "catalog_service_id" TEXT NOT NULL,
  "catalog_service_code" TEXT NOT NULL,
  "catalog_service_version" INTEGER NOT NULL,
  "provider_service_id" TEXT NOT NULL,
  "provider_service_version" INTEGER NOT NULL,
  "provider_service_price_id" TEXT NOT NULL,
  "estimated_duration_minutes" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_items_booking_id_key" ON "booking_items"("booking_id");
ALTER TABLE "booking_items"
  ADD CONSTRAINT "booking_items_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_answers" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "field_id" TEXT NOT NULL,
  "field_code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_answers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_answers_booking_id_field_id_key" ON "booking_answers"("booking_id", "field_id");
ALTER TABLE "booking_answers"
  ADD CONSTRAINT "booking_answers_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_addresses" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "source_user_address_id" TEXT NOT NULL,
  "country_code" VARCHAR(2) NOT NULL,
  "city_id" TEXT NOT NULL,
  "district_id" TEXT,
  "city_label" TEXT NOT NULL,
  "district_label" TEXT NOT NULL,
  "address_text" TEXT NOT NULL,
  "building" TEXT,
  "floor" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_addresses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_addresses_booking_id_key" ON "booking_addresses"("booking_id");
ALTER TABLE "booking_addresses"
  ADD CONSTRAINT "booking_addresses_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_media" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_media_display_order_check" CHECK ("display_order" >= 0)
);
CREATE UNIQUE INDEX "booking_media_booking_id_media_id_key" ON "booking_media"("booking_id", "media_id");
ALTER TABLE "booking_media"
  ADD CONSTRAINT "booking_media_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_snapshots" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "catalog_snapshot_json" JSONB NOT NULL,
  "provider_snapshot_json" JSONB NOT NULL,
  "catalog_hash" TEXT NOT NULL,
  "provider_hash" TEXT NOT NULL,
  "price_input_hash" TEXT NOT NULL,
  "frozen_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_snapshots_booking_id_key" ON "booking_snapshots"("booking_id");
ALTER TABLE "booking_snapshots"
  ADD CONSTRAINT "booking_snapshots_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_price_breakdowns" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "decimal_places" INTEGER NOT NULL,
  "gross_minor_units" DECIMAL(65,0) NOT NULL,
  "deposit_minor_units" DECIMAL(65,0) NOT NULL,
  "remainder_minor_units" DECIMAL(65,0) NOT NULL,
  "deposit_percent" VARCHAR(16) NOT NULL,
  "formula_version" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_price_breakdowns_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_price_breakdowns_booking_id_key" ON "booking_price_breakdowns"("booking_id");
ALTER TABLE "booking_price_breakdowns"
  ADD CONSTRAINT "booking_price_breakdowns_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "booking_status_history" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "from_status" TEXT NOT NULL,
  "to_status" "BookingStatus" NOT NULL,
  "actor_user_id" TEXT,
  "actor_type" "StatusTransitionActor" NOT NULL,
  "reason_code" TEXT,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "booking_status_history_booking_id_created_at_idx"
  ON "booking_status_history"("booking_id", "created_at");
ALTER TABLE "booking_status_history"
  ADD CONSTRAINT "booking_status_history_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_status_history"
  ADD CONSTRAINT "booking_status_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "status_transition_rules" (
  "id" TEXT NOT NULL,
  "actor" "StatusTransitionActor" NOT NULL,
  "from_status" TEXT NOT NULL,
  "to_status" TEXT NOT NULL,
  "category" "StatusTransitionCategory" NOT NULL,
  "executable" BOOLEAN NOT NULL,
  "preconditions_json" JSONB NOT NULL,
  "side_effects_json" JSONB NOT NULL,
  "audit_json" JSONB NOT NULL,
  "failure_json" JSONB NOT NULL,
  CONSTRAINT "status_transition_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "status_transition_rules_actor_from_status_to_status_key"
  ON "status_transition_rules"("actor", "from_status", "to_status");

CREATE TABLE "booking_commands" (
  "id" TEXT NOT NULL,
  "customer_user_id" TEXT NOT NULL,
  "command_type" "BookingCommandType" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "booking_id" TEXT,
  "request_hash" TEXT NOT NULL,
  "response_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_commands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_commands_customer_user_id_command_type_idempotency_key_key"
  ON "booking_commands"("customer_user_id", "command_type", "idempotency_key");
ALTER TABLE "booking_commands"
  ADD CONSTRAINT "booking_commands_customer_user_id_fkey"
  FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_commands"
  ADD CONSTRAINT "booking_commands_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "status_transition_rules"
  ("id", "actor", "from_status", "to_status", "category", "executable",
   "preconditions_json", "side_effects_json", "audit_json", "failure_json")
VALUES
  ('str_cust_none_draft', 'CUSTOMER', 'NONE', 'DRAFT', 'NORMAL', true,
   '{"verifiedCustomer":true,"eligibleTeam":true}',
   '{"persistDraft":true,"quote":true}',
   '{"actor":true,"bookingId":true}',
   '{"stateUnchanged":true}'),
  ('str_cust_draft_awaiting', 'CUSTOMER', 'DRAFT', 'AWAITING_DEPOSIT', 'NORMAL', true,
   '{"requiredAnswers":true,"eligibleTeam":true}',
   '{"freezeSnapshot":true}',
   '{"actor":true,"beforeAfter":true}',
   '{"stateUnchanged":true}'),
  ('str_cust_draft_cancelled', 'CUSTOMER', 'DRAFT', 'CANCELLED', 'CANCELLATION', true,
   '{"owner":true}',
   '{"historyOnly":true,"noFees":true}',
   '{"actor":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_cust_awaiting_cancelled', 'CUSTOMER', 'AWAITING_DEPOSIT', 'CANCELLED', 'CANCELLATION', true,
   '{"owner":true}',
   '{"historyOnly":true,"noFees":true}',
   '{"actor":true,"reason":true}',
   '{"stateUnchanged":true}'),
  ('str_sys_awaiting_confirmed', 'SYSTEM', 'AWAITING_DEPOSIT', 'CONFIRMED', 'NORMAL', false,
   '{"verifiedGatewayEvent":true,"phase":"R1-P15"}',
   '{"notExecutableInR1P13":true}',
   '{"required":true}',
   '{"TRANSITION_NOT_AVAILABLE":true}'),
  ('str_sys_confirmed_pending', 'SYSTEM', 'CONFIRMED', 'PENDING_FULFILLMENT', 'NORMAL', false,
   '{"ordersPhase":true}',
   '{"notExecutableInR1P13":true}',
   '{"required":true}',
   '{"TRANSITION_NOT_AVAILABLE":true}'),
  ('str_staff_override', 'STAFF_ADMIN', 'ANY', 'ANY', 'PRIVILEGED_OVERRIDE', false,
   '{"reasonRequired":true}',
   '{"notExecutableInR1P13":true}',
   '{"mandatory":true}',
   '{"TRANSITION_NOT_AVAILABLE":true}'),
  ('str_emergency_parallel', 'CUSTOMER', 'ACTIVE', 'EMERGENCY_SIGNALED', 'EMERGENCY_RELATED', false,
   '{"parallelFlag":"emergencySignaled"}',
   '{"notAStatus":true,"noPanicHttpInR1P13":true}',
   '{"mandatory":true}',
   '{"TRANSITION_NOT_AVAILABLE":true}');

INSERT INTO "app_configs" ("id", "key", "value", "value_kind", "resolution_policy", "description", "created_at", "updated_at")
SELECT 'r1p13_app_deposit_percent', 'commercial.deposit_percent', '25'::jsonb, 'NUMBER', 'COUNTRY_REQUIRED',
       'Country-required booking deposit percent (vision default 25)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "app_configs" WHERE "key" = 'commercial.deposit_percent');

INSERT INTO "country_configs" ("id", "country_id", "key", "value", "value_kind", "version", "created_at", "updated_at")
SELECT 'r1p13dp_' || md5(c."id"), c."id", 'commercial.deposit_percent', '25'::jsonb, 'NUMBER', 1,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "countries" c
WHERE c."code" = 'EG'
AND NOT EXISTS (
  SELECT 1 FROM "country_configs" cc
  WHERE cc."country_id" = c."id" AND cc."key" = 'commercial.deposit_percent'
);

CREATE FUNCTION "r1_p13_reject_booking_snapshot_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'booking_snapshots_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "booking_snapshots_immutable"
BEFORE UPDATE OR DELETE ON "booking_snapshots"
FOR EACH ROW EXECUTE FUNCTION "r1_p13_reject_booking_snapshot_mutation"();

CREATE FUNCTION "r1_p13_reject_booking_price_breakdown_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'booking_price_breakdowns_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "booking_price_breakdowns_immutable"
BEFORE UPDATE OR DELETE ON "booking_price_breakdowns"
FOR EACH ROW EXECUTE FUNCTION "r1_p13_reject_booking_price_breakdown_mutation"();
