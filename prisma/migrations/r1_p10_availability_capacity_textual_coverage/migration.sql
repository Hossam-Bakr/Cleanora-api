-- R1-P10 Availability, Capacity & Textual Coverage.
-- Forward-only, additive migration after r1_p09_provider_services_pricing_historical_snapshots.
-- No Country/Provider/Worker/Team row is deleted; only `platform.default_timezone`
-- AppConfig metadata is updated in place (DEC-053). Every active Country is
-- backfilled with an inherited `platform.default_timezone` CountryConfig value
-- below BEFORE the resolution policy switches, so a populated upgrade never
-- loses a resolvable time zone; prisma/seed.ts stays idempotent for clean setup.

-- Additive privileged-reason operation for Staff locality/time-zone writes
-- (DEC-053, DEC-056). No existing enum value is removed or reordered.
ALTER TYPE "PrivilegedActionOperation" ADD VALUE 'CONFIGURATION_LOCALITY_WRITE';

-- Additive optimistic-concurrency version for Staff-managed country config
-- writes (e.g. the time-zone PUT endpoint below). No existing row is removed;
-- every row defaults to version 1. Runs before the backfill INSERT below,
-- which must reference this column.
ALTER TABLE "country_configs" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Repair (item 6): backfill every active Country's platform.default_timezone
-- CountryConfig row before COUNTRY_REQUIRED takes effect. Non-Egypt countries
-- inherit the existing valid global IANA value as their starting value at
-- version 1; Egypt always ends with `Africa/Cairo` (DEC-053) even if the
-- historical global value was ever something else. An existing per-country
-- row (an explicit Staff override) is never touched — this is additive-only
-- and only fires the first time this key is backfilled per country.
-- Repair (item 5): the row id is a deterministic PostgreSQL-core text
-- identifier (`md5`), not `gen_random_uuid()` — no earlier migration
-- declares the extension that function needs, and a deterministic value
-- makes reruns of this statement idempotent-by-construction (the `NOT
-- EXISTS` guard below is the actual idempotency gate; the id merely avoids
-- an undeclared extension dependency).
INSERT INTO "country_configs" ("id", "country_id", "key", "value", "value_kind", "version", "created_at", "updated_at")
SELECT
  'r1p10bf_' || md5(c."id" || ':platform.default_timezone'),
  c."id",
  'platform.default_timezone',
  CASE WHEN c."code" = 'EG' THEN to_jsonb('Africa/Cairo'::text) ELSE ac."value" END,
  'STRING',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "countries" c
LEFT JOIN "app_configs" ac ON ac."key" = 'platform.default_timezone'
WHERE c."is_active" = true
  AND (c."code" = 'EG' OR ac."value" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "country_configs" cc
    WHERE cc."country_id" = c."id" AND cc."key" = 'platform.default_timezone'
  );

-- Evolve the existing platform.default_timezone key from GLOBAL_ONLY to
-- COUNTRY_REQUIRED only after every active country above has a resolvable
-- value. Existing global value is preserved for history; resolution now
-- requires country context (configuration.service.ts / config-key.catalog.ts).
UPDATE "app_configs"
SET "resolution_policy" = 'COUNTRY_REQUIRED'
WHERE "key" = 'platform.default_timezone';

-- ---------------------------------------------------------------------------
-- Configuration-owned localized textual hierarchy
-- ---------------------------------------------------------------------------

CREATE TABLE "cities" (
  "id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name_en" VARCHAR(200) NOT NULL,
  "name_ar" VARCHAR(200) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cities_version_positive" CHECK ("version" >= 1),
  CONSTRAINT "cities_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "cities_name_en_check" CHECK (
    "name_en" = btrim("name_en") AND char_length("name_en") BETWEEN 1 AND 200
  ),
  CONSTRAINT "cities_name_ar_check" CHECK (
    "name_ar" = btrim("name_ar") AND char_length("name_ar") BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX "cities_country_id_code_key" ON "cities"("country_id", "code");
CREATE UNIQUE INDEX "cities_country_id_name_en_key" ON "cities"("country_id", "name_en");
CREATE UNIQUE INDEX "cities_country_id_name_ar_key" ON "cities"("country_id", "name_ar");
CREATE INDEX "cities_country_id_is_active_id_idx" ON "cities"("country_id", "is_active", "id");

ALTER TABLE "cities"
  ADD CONSTRAINT "cities_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "districts" (
  "id" TEXT NOT NULL,
  "city_id" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name_en" VARCHAR(200) NOT NULL,
  "name_ar" VARCHAR(200) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "districts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "districts_version_positive" CHECK ("version" >= 1),
  CONSTRAINT "districts_code_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "districts_name_en_check" CHECK (
    "name_en" = btrim("name_en") AND char_length("name_en") BETWEEN 1 AND 200
  ),
  CONSTRAINT "districts_name_ar_check" CHECK (
    "name_ar" = btrim("name_ar") AND char_length("name_ar") BETWEEN 1 AND 200
  )
);

CREATE UNIQUE INDEX "districts_city_id_code_key" ON "districts"("city_id", "code");
CREATE UNIQUE INDEX "districts_city_id_name_en_key" ON "districts"("city_id", "name_en");
CREATE UNIQUE INDEX "districts_city_id_name_ar_key" ON "districts"("city_id", "name_ar");
CREATE INDEX "districts_city_id_is_active_id_idx" ON "districts"("city_id", "is_active", "id");

ALTER TABLE "districts"
  ADD CONSTRAINT "districts_city_id_fkey"
  FOREIGN KEY ("city_id") REFERENCES "cities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Providers-owned availability configuration, coverage, schedules, capacity
-- and pause. Batch A implements coverage read/replace; schedule, capacity and
-- pause application behavior is deferred to later Cursor batches.
-- ---------------------------------------------------------------------------

CREATE TYPE "ProviderAvailabilityCommandStatus" AS ENUM (
  'IN_PROGRESS',
  'ACCEPTED'
);

CREATE TYPE "ProviderAvailabilityHistoryTargetType" AS ENUM (
  'COVERAGE',
  'SCHEDULE',
  'SCHEDULE_EXCEPTION',
  'WORKER_SCHEDULE',
  'WORKER_SCHEDULE_EXCEPTION',
  'CAPACITY',
  'PAUSE'
);

CREATE TABLE "provider_availability_configurations" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_availability_configurations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_availability_configurations_version_positive" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "provider_availability_configurations_provider_id_key"
  ON "provider_availability_configurations"("provider_id");

ALTER TABLE "provider_availability_configurations"
  ADD CONSTRAINT "provider_availability_configurations_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_coverage_areas" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "city_id" TEXT,
  "district_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_coverage_areas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_coverage_areas_city_xor_district" CHECK (
    ("city_id" IS NOT NULL AND "district_id" IS NULL)
    OR ("city_id" IS NULL AND "district_id" IS NOT NULL)
  )
);

CREATE INDEX "provider_coverage_areas_provider_id_idx" ON "provider_coverage_areas"("provider_id");
CREATE INDEX "provider_coverage_areas_city_id_idx" ON "provider_coverage_areas"("city_id");
CREATE INDEX "provider_coverage_areas_district_id_idx" ON "provider_coverage_areas"("district_id");
-- Partial uniques enforce no duplicate city/district selection per Provider;
-- Prisma's schema layer cannot express a WHERE-qualified unique index.
CREATE UNIQUE INDEX "provider_coverage_areas_provider_city_unique"
  ON "provider_coverage_areas"("provider_id", "city_id") WHERE "city_id" IS NOT NULL;
CREATE UNIQUE INDEX "provider_coverage_areas_provider_district_unique"
  ON "provider_coverage_areas"("provider_id", "district_id") WHERE "district_id" IS NOT NULL;

ALTER TABLE "provider_coverage_areas"
  ADD CONSTRAINT "provider_coverage_areas_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_coverage_areas"
  ADD CONSTRAINT "provider_coverage_areas_city_id_fkey"
  FOREIGN KEY ("city_id") REFERENCES "cities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_coverage_areas"
  ADD CONSTRAINT "provider_coverage_areas_district_id_fkey"
  FOREIGN KEY ("district_id") REFERENCES "districts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_schedules" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "ends_next_day" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_schedules_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  CONSTRAINT "provider_schedules_minutes_range_check" CHECK (
    "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 0 AND 1439
  ),
  CONSTRAINT "provider_schedules_duration_valid" CHECK (
    (NOT "ends_next_day" AND "end_minute" > "start_minute")
    OR ("ends_next_day" AND (1440 - "start_minute" + "end_minute") BETWEEN 1 AND 1440)
  )
);

CREATE INDEX "provider_schedules_provider_id_weekday_idx" ON "provider_schedules"("provider_id", "weekday");
-- Repair (item 7): reject an exact duplicate weekly period for the same
-- Provider now; overlap validation beyond exact duplicates stays
-- application-level for Batch B.
CREATE UNIQUE INDEX "provider_schedules_no_duplicate_period_key"
  ON "provider_schedules"("provider_id", "weekday", "start_minute", "end_minute", "ends_next_day");

ALTER TABLE "provider_schedules"
  ADD CONSTRAINT "provider_schedules_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_schedule_exceptions" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "local_date" DATE NOT NULL,
  "closed" BOOLEAN NOT NULL DEFAULT false,
  "start_minute" INTEGER,
  "end_minute" INTEGER,
  "ends_next_day" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_schedule_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_schedule_exceptions_shape_check" CHECK (
    ("closed" AND "start_minute" IS NULL AND "end_minute" IS NULL AND NOT "ends_next_day")
    OR (
      NOT "closed"
      AND "start_minute" IS NOT NULL AND "end_minute" IS NOT NULL
      AND "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 0 AND 1439
      AND (
        (NOT "ends_next_day" AND "end_minute" > "start_minute")
        OR ("ends_next_day" AND (1440 - "start_minute" + "end_minute") BETWEEN 1 AND 1440)
      )
    )
  )
);

CREATE INDEX "provider_schedule_exceptions_provider_id_local_date_idx"
  ON "provider_schedule_exceptions"("provider_id", "local_date");
-- Repair (item 7, DEC-054): one civil date carries either exactly one holiday
-- row or one-or-more distinct open period rows that together fully replace
-- that date's weekly hours. Both partial uniques are WHERE-qualified, which
-- Prisma's schema layer cannot express directly.
CREATE UNIQUE INDEX "provider_schedule_exceptions_one_holiday_per_date"
  ON "provider_schedule_exceptions"("provider_id", "local_date") WHERE "closed";
CREATE UNIQUE INDEX "provider_schedule_exceptions_no_duplicate_period"
  ON "provider_schedule_exceptions"("provider_id", "local_date", "start_minute", "end_minute", "ends_next_day")
  WHERE NOT "closed";

ALTER TABLE "provider_schedule_exceptions"
  ADD CONSTRAINT "provider_schedule_exceptions_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "worker_schedules" (
  "id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "ends_next_day" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "worker_schedules_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  CONSTRAINT "worker_schedules_minutes_range_check" CHECK (
    "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 0 AND 1439
  ),
  CONSTRAINT "worker_schedules_duration_valid" CHECK (
    (NOT "ends_next_day" AND "end_minute" > "start_minute")
    OR ("ends_next_day" AND (1440 - "start_minute" + "end_minute") BETWEEN 1 AND 1440)
  )
);

CREATE INDEX "worker_schedules_worker_id_weekday_idx" ON "worker_schedules"("worker_id", "weekday");
-- Repair (item 7): reject an exact duplicate weekly period for the same
-- Worker now; overlap validation beyond exact duplicates stays
-- application-level for Batch B.
CREATE UNIQUE INDEX "worker_schedules_no_duplicate_period_key"
  ON "worker_schedules"("worker_id", "weekday", "start_minute", "end_minute", "ends_next_day");

ALTER TABLE "worker_schedules"
  ADD CONSTRAINT "worker_schedules_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "worker_schedule_exceptions" (
  "id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "local_date" DATE NOT NULL,
  "closed" BOOLEAN NOT NULL DEFAULT false,
  "start_minute" INTEGER,
  "end_minute" INTEGER,
  "ends_next_day" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_schedule_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "worker_schedule_exceptions_shape_check" CHECK (
    ("closed" AND "start_minute" IS NULL AND "end_minute" IS NULL AND NOT "ends_next_day")
    OR (
      NOT "closed"
      AND "start_minute" IS NOT NULL AND "end_minute" IS NOT NULL
      AND "start_minute" BETWEEN 0 AND 1439 AND "end_minute" BETWEEN 0 AND 1439
      AND (
        (NOT "ends_next_day" AND "end_minute" > "start_minute")
        OR ("ends_next_day" AND (1440 - "start_minute" + "end_minute") BETWEEN 1 AND 1440)
      )
    )
  )
);

CREATE INDEX "worker_schedule_exceptions_worker_id_local_date_idx"
  ON "worker_schedule_exceptions"("worker_id", "local_date");
-- Repair (item 7, DEC-054): same one-holiday-or-many-open-periods shape as
-- `provider_schedule_exceptions` above.
CREATE UNIQUE INDEX "worker_schedule_exceptions_one_holiday_per_date"
  ON "worker_schedule_exceptions"("worker_id", "local_date") WHERE "closed";
CREATE UNIQUE INDEX "worker_schedule_exceptions_no_duplicate_period"
  ON "worker_schedule_exceptions"("worker_id", "local_date", "start_minute", "end_minute", "ends_next_day")
  WHERE NOT "closed";

ALTER TABLE "worker_schedule_exceptions"
  ADD CONSTRAINT "worker_schedule_exceptions_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "provider_workers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_capacity_rules" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "max_simultaneous_teams" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_capacity_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_capacity_rules_version_positive" CHECK ("version" >= 1),
  CONSTRAINT "provider_capacity_rules_max_teams_check" CHECK (
    "max_simultaneous_teams" BETWEEN 1 AND 50
  )
);

CREATE UNIQUE INDEX "provider_capacity_rules_provider_id_key" ON "provider_capacity_rules"("provider_id");

ALTER TABLE "provider_capacity_rules"
  ADD CONSTRAINT "provider_capacity_rules_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_temporary_pauses" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3),
  "resumed_at" TIMESTAMP(3),
  "actor_user_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_temporary_pauses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_temporary_pauses_version_positive" CHECK ("version" >= 1),
  CONSTRAINT "provider_temporary_pauses_ends_after_start" CHECK (
    "ends_at" IS NULL OR "ends_at" > "started_at"
  ),
  CONSTRAINT "provider_temporary_pauses_resumed_after_start" CHECK (
    "resumed_at" IS NULL OR "resumed_at" >= "started_at"
  )
);

CREATE INDEX "provider_temporary_pauses_provider_id_idx" ON "provider_temporary_pauses"("provider_id");
-- At most one unresolved (not yet resumed) pause per Provider (DEC-057).
CREATE UNIQUE INDEX "provider_temporary_pauses_one_unresolved_per_provider"
  ON "provider_temporary_pauses"("provider_id") WHERE "resumed_at" IS NULL;

ALTER TABLE "provider_temporary_pauses"
  ADD CONSTRAINT "provider_temporary_pauses_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_temporary_pauses"
  ADD CONSTRAINT "provider_temporary_pauses_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_availability_commands" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "scope_key" VARCHAR(240) NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "status" "ProviderAvailabilityCommandStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "safe_result_code" VARCHAR(100),
  "safe_result_json" JSONB,
  "actor_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "provider_availability_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_availability_commands_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "provider_availability_commands_status_shape_check" CHECK (
    ("status" = 'IN_PROGRESS' AND "completed_at" IS NULL)
    OR ("status" = 'ACCEPTED' AND "completed_at" IS NOT NULL AND "safe_result_code" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "provider_availability_commands_scope_idempotency_unique"
  ON "provider_availability_commands"("scope_key", "idempotency_key");
CREATE INDEX "provider_availability_commands_provider_id_created_at_idx"
  ON "provider_availability_commands"("provider_id", "created_at");

ALTER TABLE "provider_availability_commands"
  ADD CONSTRAINT "provider_availability_commands_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_availability_commands"
  ADD CONSTRAINT "provider_availability_commands_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_availability_history" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "target_type" "ProviderAvailabilityHistoryTargetType" NOT NULL,
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
  CONSTRAINT "provider_availability_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_availability_history_target_version_positive" CHECK ("target_version" >= 1),
  CONSTRAINT "provider_availability_history_event_code_check" CHECK (
    char_length(btrim("event_code")) > 0
  ),
  CONSTRAINT "provider_availability_history_request_id_check" CHECK (
    char_length(btrim("request_id")) > 0
  )
);

CREATE INDEX "provider_availability_history_target_idx"
  ON "provider_availability_history"("provider_id", "target_type", "target_id", "created_at", "id");
CREATE INDEX "provider_availability_history_actor_idx"
  ON "provider_availability_history"("actor_user_id", "created_at");

ALTER TABLE "provider_availability_history"
  ADD CONSTRAINT "provider_availability_history_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_availability_history"
  ADD CONSTRAINT "provider_availability_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only history ledger (ERRCODE 55000 matches R1-P07/R1-P09 immutable history style).
CREATE FUNCTION "r1_p10_reject_availability_history_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'provider_availability_history_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_availability_history_immutable"
BEFORE UPDATE OR DELETE ON "provider_availability_history"
FOR EACH ROW EXECUTE FUNCTION "r1_p10_reject_availability_history_mutation"();

-- ---------------------------------------------------------------------------
-- Repair (item 5): Configuration-owned durable UUID-idempotency receipt for
-- Staff locality/time-zone mutations (city/district create+update, country
-- time-zone PUT). Mirrors provider_availability_commands's scope+key
-- uniqueness and fingerprint-bound replay shape; never shared with Catalog's
-- or Providers' own command-receipt tables.
-- ---------------------------------------------------------------------------

CREATE TYPE "ConfigurationLocalityCommandStatus" AS ENUM (
  'IN_PROGRESS',
  'ACCEPTED'
);

CREATE TABLE "configuration_locality_commands" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "scope_key" VARCHAR(240) NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "status" "ConfigurationLocalityCommandStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "safe_result_code" VARCHAR(100),
  "safe_result_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "configuration_locality_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "configuration_locality_commands_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "configuration_locality_commands_status_shape_check" CHECK (
    ("status" = 'IN_PROGRESS' AND "completed_at" IS NULL)
    OR ("status" = 'ACCEPTED' AND "completed_at" IS NOT NULL AND "safe_result_code" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "configuration_locality_commands_scope_idempotency_unique"
  ON "configuration_locality_commands"("scope_key", "idempotency_key");
CREATE INDEX "configuration_locality_commands_actor_user_id_created_at_idx"
  ON "configuration_locality_commands"("actor_user_id", "created_at");

ALTER TABLE "configuration_locality_commands"
  ADD CONSTRAINT "configuration_locality_commands_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
