-- R1-P08 Catalog, Localization & Service Requirements.
-- Forward-only, additive migration after r1_p07_worker_team_crew_management.

CREATE TYPE "CatalogLocale" AS ENUM ('AR', 'EN');
CREATE TYPE "ServiceFieldKind" AS ENUM (
  'INFORMATION',
  'TEXT',
  'NUMBER',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT'
);
CREATE TYPE "ServiceNumberMode" AS ENUM ('INTEGER', 'DECIMAL');
CREATE TYPE "CatalogCommandStatus" AS ENUM ('PENDING', 'COMPLETED');

ALTER TYPE "MediaOwnerType" ADD VALUE 'CATALOG_SERVICE_IMAGE';
ALTER TYPE "PrivilegedActionOperation" ADD VALUE 'CATALOG_MANAGEMENT_WRITE';

CREATE TABLE "service_categories" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name_ar" VARCHAR(160),
  "name_en" VARCHAR(160),
  "description_ar" VARCHAR(2000),
  "description_en" VARCHAR(2000),
  "display_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_categories_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "service_categories_display_order_nonneg_check" CHECK ("display_order" >= 0),
  CONSTRAINT "service_categories_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");
CREATE UNIQUE INDEX "service_categories_display_order_key" ON "service_categories"("display_order");

CREATE TABLE "services" (
  "id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "display_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "services_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "services_display_order_nonneg_check" CHECK ("display_order" >= 0),
  CONSTRAINT "services_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "services_code_key" ON "services"("code");
CREATE UNIQUE INDEX "services_category_id_display_order_key" ON "services"("category_id", "display_order");
CREATE INDEX "services_category_id_is_active_display_order_idx" ON "services"("category_id", "is_active", "display_order");

CREATE TABLE "service_translations" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "locale" "CatalogLocale" NOT NULL,
  "name" VARCHAR(160),
  "description" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_translations_service_id_locale_key" ON "service_translations"("service_id", "locale");

CREATE TABLE "service_price_units" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "label_ar" VARCHAR(120),
  "label_en" VARCHAR(120),
  "display_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_price_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_price_units_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "service_price_units_display_order_nonneg_check" CHECK ("display_order" >= 0)
);

CREATE UNIQUE INDEX "service_price_units_service_id_code_key" ON "service_price_units"("service_id", "code");
CREATE UNIQUE INDEX "service_price_units_service_id_display_order_key" ON "service_price_units"("service_id", "display_order");

CREATE TABLE "service_fields" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "kind" "ServiceFieldKind" NOT NULL,
  "label_ar" VARCHAR(300),
  "label_en" VARCHAR(300),
  "help_text_ar" VARCHAR(1000),
  "help_text_en" VARCHAR(1000),
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "min_length" INTEGER,
  "max_length" INTEGER,
  "number_mode" "ServiceNumberMode",
  "min_value" DECIMAL(18,3),
  "max_value" DECIMAL(18,3),
  "min_selections" INTEGER,
  "max_selections" INTEGER,
  "display_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_fields_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_fields_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "service_fields_display_order_nonneg_check" CHECK ("display_order" >= 0),
  CONSTRAINT "service_fields_information_required_check" CHECK (
    ("kind" <> 'INFORMATION') OR ("is_required" = false)
  ),
  CONSTRAINT "service_fields_text_bounds_check" CHECK (
    ("kind" = 'TEXT')
    OR ("min_length" IS NULL AND "max_length" IS NULL)
  ),
  CONSTRAINT "service_fields_text_length_nonneg_check" CHECK (
    ("min_length" IS NULL OR "min_length" >= 0)
    AND ("max_length" IS NULL OR "max_length" >= 0)
  ),
  CONSTRAINT "service_fields_text_length_order_check" CHECK (
    "min_length" IS NULL
    OR "max_length" IS NULL
    OR "max_length" >= "min_length"
  ),
  CONSTRAINT "service_fields_number_mode_check" CHECK (
    (("kind" = 'NUMBER') AND ("number_mode" IS NOT NULL))
    OR (("kind" <> 'NUMBER') AND ("number_mode" IS NULL AND "min_value" IS NULL AND "max_value" IS NULL))
  ),
  CONSTRAINT "service_fields_number_bounds_order_check" CHECK (
    "min_value" IS NULL
    OR "max_value" IS NULL
    OR "max_value" >= "min_value"
  ),
  CONSTRAINT "service_fields_selection_bounds_kind_check" CHECK (
    ("kind" = 'MULTI_SELECT')
    OR ("min_selections" IS NULL AND "max_selections" IS NULL)
  ),
  CONSTRAINT "service_fields_selection_bounds_nonneg_check" CHECK (
    ("min_selections" IS NULL OR "min_selections" >= 0)
    AND ("max_selections" IS NULL OR "max_selections" >= 0)
  ),
  CONSTRAINT "service_fields_selection_bounds_order_check" CHECK (
    "min_selections" IS NULL
    OR "max_selections" IS NULL
    OR "max_selections" >= "min_selections"
  )
);

CREATE UNIQUE INDEX "service_fields_service_id_code_key" ON "service_fields"("service_id", "code");
CREATE UNIQUE INDEX "service_fields_service_id_display_order_key" ON "service_fields"("service_id", "display_order");

CREATE TABLE "service_field_options" (
  "id" TEXT NOT NULL,
  "service_field_id" TEXT NOT NULL,
  "value" VARCHAR(80) NOT NULL,
  "label_ar" VARCHAR(200),
  "label_en" VARCHAR(200),
  "display_order" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_field_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_field_options_value_format_check" CHECK ("value" ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT "service_field_options_display_order_nonneg_check" CHECK ("display_order" >= 0)
);

CREATE UNIQUE INDEX "service_field_options_service_field_id_value_key" ON "service_field_options"("service_field_id", "value");
CREATE UNIQUE INDEX "service_field_options_service_field_id_display_order_key" ON "service_field_options"("service_field_id", "display_order");

CREATE TABLE "service_country_availability" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "country_id" TEXT NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_country_availability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_country_availability_service_id_country_id_key" ON "service_country_availability"("service_id", "country_id");
CREATE INDEX "service_country_availability_country_id_is_available_service_id_idx" ON "service_country_availability"("country_id", "is_available", "service_id");
CREATE INDEX "service_country_availability_service_id_is_available_idx" ON "service_country_availability"("service_id", "is_available");

CREATE TABLE "service_media_associations" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "media_file_id" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_media_associations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_media_associations_display_order_nonneg_check" CHECK ("display_order" >= 0)
);

CREATE UNIQUE INDEX "service_media_associations_media_file_id_key" ON "service_media_associations"("media_file_id");
CREATE UNIQUE INDEX "service_media_associations_service_id_display_order_key" ON "service_media_associations"("service_id", "display_order");

CREATE TABLE "catalog_command_requests" (
  "id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "scope_key" VARCHAR(200) NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "status" "CatalogCommandStatus" NOT NULL,
  "target_type" VARCHAR(80) NOT NULL,
  "target_id" TEXT,
  "accepted_version" INTEGER,
  "reserved_media_file_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "catalog_command_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_command_requests_hash_format_check" CHECK ("request_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "catalog_command_requests_completed_shape_check" CHECK (
    (
      "status" = 'COMPLETED'
      AND "completed_at" IS NOT NULL
      AND "accepted_version" > 0
    )
    OR (
      "status" = 'PENDING'
      AND "completed_at" IS NULL
      AND "accepted_version" IS NULL
      AND "reserved_media_file_id" IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX "catalog_command_requests_actor_scope_idempotency_key" ON "catalog_command_requests"("actor_user_id", "scope_key", "idempotency_key");
CREATE INDEX "catalog_command_requests_actor_user_id_created_at_idx" ON "catalog_command_requests"("actor_user_id", "created_at");

ALTER TABLE "services"
  ADD CONSTRAINT "services_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "service_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_translations"
  ADD CONSTRAINT "service_translations_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_price_units"
  ADD CONSTRAINT "service_price_units_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_fields"
  ADD CONSTRAINT "service_fields_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_field_options"
  ADD CONSTRAINT "service_field_options_service_field_id_fkey"
  FOREIGN KEY ("service_field_id") REFERENCES "service_fields"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_country_availability"
  ADD CONSTRAINT "service_country_availability_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_country_availability"
  ADD CONSTRAINT "service_country_availability_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_media_associations"
  ADD CONSTRAINT "service_media_associations_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_media_associations"
  ADD CONSTRAINT "service_media_associations_media_file_id_fkey"
  FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
