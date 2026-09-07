-- R1-P09 Provider Services, Pricing & Historical Snapshots.
-- Forward-only, additive migration after r1_p08_catalog_localization_service_requirements.
-- No Provider offering, price, or history rows are inserted.

CREATE TYPE "ProviderServicePriceStatus" AS ENUM (
  'PENDING',
  'EFFECTIVE',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE "ProviderServicePriceHistoryEvent" AS ENUM (
  'PRICE_PROPOSED_PENDING',
  'PRICE_EFFECTIVE_IMMEDIATE',
  'PRICE_APPROVED',
  'PRICE_REJECTED',
  'PRICE_SUPERSEDED_PENDING',
  'PRICE_SUPERSEDED_EFFECTIVE'
);

CREATE TYPE "ProviderServiceStatusHistoryEvent" AS ENUM (
  'OFFERING_CREATED',
  'CONFIGURATION_UPDATED',
  'OFFERING_ENABLED',
  'OFFERING_DISABLED'
);

CREATE TABLE "provider_services" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "catalog_service_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "estimated_duration_minutes" INTEGER NOT NULL,
  "note_ar" VARCHAR(1000),
  "note_en" VARCHAR(1000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_services_duration_valid" CHECK (
    "estimated_duration_minutes" BETWEEN 1 AND 1440
  ),
  CONSTRAINT "provider_services_version_positive" CHECK ("version" >= 1),
  CONSTRAINT "provider_services_notes_pair_valid" CHECK (
    ("note_ar" IS NULL AND "note_en" IS NULL)
    OR (
      "note_ar" IS NOT NULL
      AND "note_en" IS NOT NULL
      AND "note_ar" = btrim("note_ar")
      AND "note_en" = btrim("note_en")
      AND char_length("note_ar") BETWEEN 1 AND 1000
      AND char_length("note_en") BETWEEN 1 AND 1000
    )
  )
);

CREATE UNIQUE INDEX "provider_services_provider_catalog_service_key"
  ON "provider_services"("provider_id", "catalog_service_id");
CREATE UNIQUE INDEX "provider_services_id_provider_id_key"
  ON "provider_services"("id", "provider_id");
CREATE UNIQUE INDEX "provider_services_id_catalog_service_id_key"
  ON "provider_services"("id", "catalog_service_id");
CREATE INDEX "provider_services_provider_id_enabled_id_idx"
  ON "provider_services"("provider_id", "enabled", "id");
CREATE INDEX "provider_services_catalog_service_id_provider_id_idx"
  ON "provider_services"("catalog_service_id", "provider_id");

ALTER TABLE "provider_services"
  ADD CONSTRAINT "provider_services_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_services"
  ADD CONSTRAINT "provider_services_catalog_service_id_fkey"
  FOREIGN KEY ("catalog_service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supporting composite unique for Providers price-unit/service FK integrity.
CREATE UNIQUE INDEX IF NOT EXISTS "service_price_units_id_service_id_key"
  ON "service_price_units"("id", "service_id");

CREATE TABLE "provider_service_prices" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "provider_service_id" TEXT NOT NULL,
  "catalog_service_id" TEXT NOT NULL,
  "catalog_price_unit_id" TEXT NOT NULL,
  "price_unit_code_at_proposal" VARCHAR(64) NOT NULL,
  "country_id_at_proposal" TEXT NOT NULL,
  "country_code_at_proposal" VARCHAR(2) NOT NULL,
  "currency_id" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "currency_decimal_places" INTEGER NOT NULL,
  "provider_price_minor_units" DECIMAL(65, 0) NOT NULL,
  "minimum_charge_minor_units" DECIMAL(65, 0) NOT NULL,
  "maximum_price_minor_units_at_proposal" DECIMAL(65, 0) NOT NULL,
  "approval_required_at_proposal" BOOLEAN NOT NULL,
  "status" "ProviderServicePriceStatus" NOT NULL,
  "proposed_by_user_id" TEXT NOT NULL,
  "effective_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_service_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_service_prices_currency_decimal_places_check" CHECK (
    "currency_decimal_places" BETWEEN 0 AND 30
  ),
  CONSTRAINT "provider_service_prices_country_code_check" CHECK (
    "country_code_at_proposal" ~ '^[A-Z]{2}$'
  ),
  CONSTRAINT "provider_service_prices_currency_code_check" CHECK (
    "currency_code" ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT "provider_service_prices_price_unit_code_check" CHECK (
    "price_unit_code_at_proposal" ~ '^[A-Z][A-Z0-9_]*$'
  ),
  CONSTRAINT "provider_service_prices_minor_units_valid" CHECK (
    "provider_price_minor_units" > 0
    AND scale("provider_price_minor_units") = 0
    AND "minimum_charge_minor_units" > 0
    AND scale("minimum_charge_minor_units") = 0
    AND "maximum_price_minor_units_at_proposal" > 0
    AND scale("maximum_price_minor_units_at_proposal") = 0
    AND "minimum_charge_minor_units" >= "provider_price_minor_units"
    AND "provider_price_minor_units" <= "maximum_price_minor_units_at_proposal"
    AND "minimum_charge_minor_units" <= "maximum_price_minor_units_at_proposal"
  ),
  CONSTRAINT "provider_service_prices_status_timestamps_check" CHECK (
    (
      "status" = 'PENDING'
      AND "effective_at" IS NULL
      AND "rejected_at" IS NULL
      AND "superseded_at" IS NULL
    )
    OR (
      "status" = 'EFFECTIVE'
      AND "effective_at" IS NOT NULL
      AND "rejected_at" IS NULL
      AND "superseded_at" IS NULL
    )
    OR (
      "status" = 'REJECTED'
      AND "rejected_at" IS NOT NULL
      AND "effective_at" IS NULL
      AND "superseded_at" IS NULL
    )
    OR (
      "status" = 'SUPERSEDED'
      AND "superseded_at" IS NOT NULL
      AND "rejected_at" IS NULL
    )
  )
);

CREATE UNIQUE INDEX "provider_service_prices_id_provider_service_id_provider_id_key"
  ON "provider_service_prices"("id", "provider_service_id", "provider_id");
CREATE UNIQUE INDEX "provider_service_prices_pending_unique"
  ON "provider_service_prices"("provider_service_id")
  WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX "provider_service_prices_effective_unique"
  ON "provider_service_prices"("provider_service_id")
  WHERE "status" = 'EFFECTIVE';
CREATE INDEX "provider_service_prices_provider_service_id_created_at_id_idx"
  ON "provider_service_prices"("provider_service_id", "created_at", "id");
CREATE INDEX "provider_service_prices_provider_id_status_created_at_id_idx"
  ON "provider_service_prices"("provider_id", "status", "created_at", "id");

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_provider_service_id_provider_id_fkey"
  FOREIGN KEY ("provider_service_id", "provider_id")
  REFERENCES "provider_services"("id", "provider_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_provider_service_id_catalog_service_id_fkey"
  FOREIGN KEY ("provider_service_id", "catalog_service_id")
  REFERENCES "provider_services"("id", "catalog_service_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_catalog_price_unit_id_catalog_service_id_fkey"
  FOREIGN KEY ("catalog_price_unit_id", "catalog_service_id")
  REFERENCES "service_price_units"("id", "service_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_country_id_at_proposal_fkey"
  FOREIGN KEY ("country_id_at_proposal") REFERENCES "countries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_currency_id_fkey"
  FOREIGN KEY ("currency_id") REFERENCES "currencies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_prices"
  ADD CONSTRAINT "provider_service_prices_proposed_by_user_id_fkey"
  FOREIGN KEY ("proposed_by_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_service_price_history" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "provider_service_id" TEXT NOT NULL,
  "provider_service_price_id" TEXT NOT NULL,
  "event" "ProviderServicePriceHistoryEvent" NOT NULL,
  "from_status" "ProviderServicePriceStatus",
  "to_status" "ProviderServicePriceStatus" NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason_code" VARCHAR(100) NOT NULL,
  "reason_text" VARCHAR(1000),
  "safe_before" JSONB,
  "safe_after" JSONB NOT NULL,
  "request_id" VARCHAR(200) NOT NULL,
  "aggregate_version" INTEGER NOT NULL,
  "scope_key" VARCHAR(240),
  "idempotency_key" VARCHAR(200),
  "request_fingerprint" CHAR(64),
  "safe_result_code" VARCHAR(100),
  "safe_result_json" JSONB,
  "operation_key" VARCHAR(240) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_service_price_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_service_price_history_aggregate_version_positive" CHECK (
    "aggregate_version" >= 1
  ),
  CONSTRAINT "provider_service_price_history_reason_code_check" CHECK (
    char_length(btrim("reason_code")) > 0
  ),
  CONSTRAINT "provider_service_price_history_reason_text_check" CHECK (
    "reason_text" IS NULL
    OR (
      "reason_text" = btrim("reason_text")
      AND char_length("reason_text") BETWEEN 1 AND 1000
    )
  ),
  CONSTRAINT "provider_service_price_history_request_id_check" CHECK (
    char_length(btrim("request_id")) > 0
  ),
  CONSTRAINT "provider_service_price_history_operation_key_check" CHECK (
    char_length(btrim("operation_key")) > 0
  ),
  CONSTRAINT "provider_service_price_history_receipt_all_or_none" CHECK (
    (
      "scope_key" IS NULL
      AND "idempotency_key" IS NULL
      AND "request_fingerprint" IS NULL
      AND "safe_result_code" IS NULL
      AND "safe_result_json" IS NULL
    )
    OR (
      "scope_key" IS NOT NULL
      AND "idempotency_key" IS NOT NULL
      AND "request_fingerprint" IS NOT NULL
      AND "safe_result_code" IS NOT NULL
      AND "safe_result_json" IS NOT NULL
    )
  ),
  CONSTRAINT "provider_service_price_history_fingerprint_sha256" CHECK (
    "request_fingerprint" IS NULL
    OR "request_fingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "provider_service_price_history_operation_key_key"
  ON "provider_service_price_history"("operation_key");
CREATE UNIQUE INDEX "provider_service_price_history_scope_idempotency_unique"
  ON "provider_service_price_history"("scope_key", "idempotency_key")
  WHERE "scope_key" IS NOT NULL AND "idempotency_key" IS NOT NULL;
CREATE INDEX "provider_service_price_history_provider_id_provider_service_id_created_at_id_idx"
  ON "provider_service_price_history"("provider_id", "provider_service_id", "created_at", "id");
CREATE INDEX "provider_service_price_history_provider_service_price_id_created_at_id_idx"
  ON "provider_service_price_history"("provider_service_price_id", "created_at", "id");
CREATE INDEX "provider_service_price_history_actor_user_id_created_at_idx"
  ON "provider_service_price_history"("actor_user_id", "created_at");
CREATE INDEX "provider_service_price_history_request_id_event_idx"
  ON "provider_service_price_history"("request_id", "event");

ALTER TABLE "provider_service_price_history"
  ADD CONSTRAINT "provider_service_price_history_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_price_history"
  ADD CONSTRAINT "provider_service_price_history_provider_service_id_provider_id_fkey"
  FOREIGN KEY ("provider_service_id", "provider_id")
  REFERENCES "provider_services"("id", "provider_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_price_history"
  ADD CONSTRAINT "provider_service_price_history_price_scope_fkey"
  FOREIGN KEY ("provider_service_price_id", "provider_service_id", "provider_id")
  REFERENCES "provider_service_prices"("id", "provider_service_id", "provider_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_price_history"
  ADD CONSTRAINT "provider_service_price_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_service_status_history" (
  "id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "provider_service_id" TEXT NOT NULL,
  "event" "ProviderServiceStatusHistoryEvent" NOT NULL,
  "from_enabled" BOOLEAN,
  "to_enabled" BOOLEAN NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason_code" VARCHAR(100) NOT NULL,
  "reason_text" VARCHAR(1000),
  "safe_before" JSONB,
  "safe_after" JSONB NOT NULL,
  "request_id" VARCHAR(200) NOT NULL,
  "aggregate_version" INTEGER NOT NULL,
  "scope_key" VARCHAR(240) NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "safe_result_code" VARCHAR(100) NOT NULL,
  "safe_result_json" JSONB NOT NULL,
  "operation_key" VARCHAR(240) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_service_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_service_status_history_aggregate_version_positive" CHECK (
    "aggregate_version" >= 1
  ),
  CONSTRAINT "provider_service_status_history_reason_code_check" CHECK (
    char_length(btrim("reason_code")) > 0
  ),
  CONSTRAINT "provider_service_status_history_request_id_check" CHECK (
    char_length(btrim("request_id")) > 0
  ),
  CONSTRAINT "provider_service_status_history_operation_key_check" CHECK (
    char_length(btrim("operation_key")) > 0
  ),
  CONSTRAINT "provider_service_status_history_fingerprint_sha256" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "provider_service_status_history_event_values_check" CHECK (
    (
      "event" = 'OFFERING_CREATED'
      AND "from_enabled" IS NULL
      AND "to_enabled" = false
      AND "reason_text" IS NULL
    )
    OR (
      "event" = 'CONFIGURATION_UPDATED'
      AND "from_enabled" IS NOT NULL
      AND "from_enabled" = "to_enabled"
      AND "reason_text" IS NULL
    )
    OR (
      "event" = 'OFFERING_ENABLED'
      AND "from_enabled" = false
      AND "to_enabled" = true
      AND "reason_text" IS NOT NULL
      AND "reason_text" = btrim("reason_text")
      AND char_length("reason_text") BETWEEN 1 AND 1000
    )
    OR (
      "event" = 'OFFERING_DISABLED'
      AND "from_enabled" = true
      AND "to_enabled" = false
      AND "reason_text" IS NOT NULL
      AND "reason_text" = btrim("reason_text")
      AND char_length("reason_text") BETWEEN 1 AND 1000
    )
  )
);

CREATE UNIQUE INDEX "provider_service_status_history_operation_key_key"
  ON "provider_service_status_history"("operation_key");
CREATE UNIQUE INDEX "provider_service_status_history_scope_key_idempotency_key_key"
  ON "provider_service_status_history"("scope_key", "idempotency_key");
CREATE INDEX "provider_service_status_history_provider_id_provider_service_id_created_at_id_idx"
  ON "provider_service_status_history"("provider_id", "provider_service_id", "created_at", "id");
CREATE INDEX "provider_service_status_history_actor_user_id_created_at_idx"
  ON "provider_service_status_history"("actor_user_id", "created_at");
CREATE INDEX "provider_service_status_history_request_id_event_idx"
  ON "provider_service_status_history"("request_id", "event");

ALTER TABLE "provider_service_status_history"
  ADD CONSTRAINT "provider_service_status_history_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_status_history"
  ADD CONSTRAINT "provider_service_status_history_provider_service_id_provider_id_fkey"
  FOREIGN KEY ("provider_service_id", "provider_id")
  REFERENCES "provider_services"("id", "provider_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_service_status_history"
  ADD CONSTRAINT "provider_service_status_history_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only history ledgers (ERRCODE 55000 matches R1-P07 immutable history style).
CREATE FUNCTION "r1_p09_reject_price_history_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'provider_service_price_history_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_service_price_history_immutable"
BEFORE UPDATE OR DELETE ON "provider_service_price_history"
FOR EACH ROW EXECUTE FUNCTION "r1_p09_reject_price_history_mutation"();

CREATE FUNCTION "r1_p09_reject_status_history_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'provider_service_status_history_immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_service_status_history_immutable"
BEFORE UPDATE OR DELETE ON "provider_service_status_history"
FOR EACH ROW EXECUTE FUNCTION "r1_p09_reject_status_history_mutation"();

-- Price rows reject DELETE and commercial/identity rewrites; only legal lifecycle
-- transitions may mutate status + effective_at / rejected_at / superseded_at.
CREATE FUNCTION "r1_p09_enforce_provider_service_price_lifecycle"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'provider_service_prices_delete_forbidden' USING ERRCODE = '55000';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."provider_id" IS DISTINCT FROM OLD."provider_id"
     OR NEW."provider_service_id" IS DISTINCT FROM OLD."provider_service_id"
     OR NEW."catalog_service_id" IS DISTINCT FROM OLD."catalog_service_id"
     OR NEW."catalog_price_unit_id" IS DISTINCT FROM OLD."catalog_price_unit_id"
     OR NEW."price_unit_code_at_proposal" IS DISTINCT FROM OLD."price_unit_code_at_proposal"
     OR NEW."country_id_at_proposal" IS DISTINCT FROM OLD."country_id_at_proposal"
     OR NEW."country_code_at_proposal" IS DISTINCT FROM OLD."country_code_at_proposal"
     OR NEW."currency_id" IS DISTINCT FROM OLD."currency_id"
     OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code"
     OR NEW."currency_decimal_places" IS DISTINCT FROM OLD."currency_decimal_places"
     OR NEW."provider_price_minor_units" IS DISTINCT FROM OLD."provider_price_minor_units"
     OR NEW."minimum_charge_minor_units" IS DISTINCT FROM OLD."minimum_charge_minor_units"
     OR NEW."maximum_price_minor_units_at_proposal" IS DISTINCT FROM OLD."maximum_price_minor_units_at_proposal"
     OR NEW."approval_required_at_proposal" IS DISTINCT FROM OLD."approval_required_at_proposal"
     OR NEW."proposed_by_user_id" IS DISTINCT FROM OLD."proposed_by_user_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'provider_service_prices_commercial_immutable' USING ERRCODE = '55000';
  END IF;

  IF NEW."status" IS NOT DISTINCT FROM OLD."status"
     AND NEW."effective_at" IS NOT DISTINCT FROM OLD."effective_at"
     AND NEW."rejected_at" IS NOT DISTINCT FROM OLD."rejected_at"
     AND NEW."superseded_at" IS NOT DISTINCT FROM OLD."superseded_at" THEN
    RETURN NEW;
  END IF;

  -- PENDING -> EFFECTIVE (Staff approve)
  IF OLD."status" = 'PENDING'
     AND NEW."status" = 'EFFECTIVE'
     AND OLD."effective_at" IS NULL
     AND NEW."effective_at" IS NOT NULL
     AND OLD."rejected_at" IS NULL
     AND NEW."rejected_at" IS NULL
     AND OLD."superseded_at" IS NULL
     AND NEW."superseded_at" IS NULL THEN
    RETURN NEW;
  END IF;

  -- PENDING -> REJECTED (Staff reject)
  IF OLD."status" = 'PENDING'
     AND NEW."status" = 'REJECTED'
     AND OLD."rejected_at" IS NULL
     AND NEW."rejected_at" IS NOT NULL
     AND OLD."effective_at" IS NULL
     AND NEW."effective_at" IS NULL
     AND OLD."superseded_at" IS NULL
     AND NEW."superseded_at" IS NULL THEN
    RETURN NEW;
  END IF;

  -- PENDING -> SUPERSEDED (replaced by a later accepted proposal)
  IF OLD."status" = 'PENDING'
     AND NEW."status" = 'SUPERSEDED'
     AND OLD."superseded_at" IS NULL
     AND NEW."superseded_at" IS NOT NULL
     AND OLD."effective_at" IS NULL
     AND NEW."effective_at" IS NULL
     AND OLD."rejected_at" IS NULL
     AND NEW."rejected_at" IS NULL THEN
    RETURN NEW;
  END IF;

  -- EFFECTIVE -> SUPERSEDED (retain first effective_at)
  IF OLD."status" = 'EFFECTIVE'
     AND NEW."status" = 'SUPERSEDED'
     AND OLD."superseded_at" IS NULL
     AND NEW."superseded_at" IS NOT NULL
     AND OLD."effective_at" IS NOT NULL
     AND NEW."effective_at" IS NOT DISTINCT FROM OLD."effective_at"
     AND OLD."rejected_at" IS NULL
     AND NEW."rejected_at" IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'provider_service_prices_illegal_transition' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_service_prices_lifecycle_immutable"
BEFORE UPDATE OR DELETE ON "provider_service_prices"
FOR EACH ROW EXECUTE FUNCTION "r1_p09_enforce_provider_service_price_lifecycle"();
