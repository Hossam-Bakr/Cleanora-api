import { readFileSync } from "node:fs";
import { join } from "node:path";


import {
  assertR1P08DisposableDatabaseUrl,
  R1_P08_MIGRATION,
} from "../../../scripts/validate-r1-p08-upgrade.js";

vi.setConfig({ testTimeout: 180_000 });

const migrationSql = readFileSync(
  join(process.cwd(), "prisma", "migrations", R1_P08_MIGRATION, "migration.sql"),
  "utf8",
).replaceAll("\r\n", "\n");
const schema = readFileSync(
  join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
).replaceAll("\r\n", "\n");

/**
 * R1-P08 PostgreSQL constraint contract (FR-017–FR-020, FR-024, FR-034–FR-035,
 * FR-051).
 *
 * These assertions are static reads of the phase-owned migration SQL and
 * `prisma/schema.prisma`. No database connection is opened here. The live
 * probe block below stays skipped until an owner approves a disposable target
 * in `CLEANORA_R1_P08_DATABASE_URL`; the repository `.env` database, the
 * historical `Cleanora` database, and any production target are never used.
 */

const approvedLiveTarget = ((): string | null => {
  const url = process.env["CLEANORA_R1_P08_DATABASE_URL"];
  if (url === undefined || url.trim().length === 0) {
    return null;
  }
  assertR1P08DisposableDatabaseUrl(url);
  return url;
})();

function expectUniqueIndex(name: string, table: string, columns: readonly string[]): void {
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  expect(migrationSql).toContain(
    `CREATE UNIQUE INDEX "${name}" ON "${table}"(${quoted})`,
  );
}

describe("R1-P08 migration constraint contract (static)", () => {
  it("enforces uppercase stable-code formats for every Catalog identity", () => {
    for (const check of [
      `CONSTRAINT "service_categories_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'`,
      `CONSTRAINT "services_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'`,
      `CONSTRAINT "service_price_units_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'`,
      `CONSTRAINT "service_fields_code_format_check" CHECK ("code" ~ '^[A-Z][A-Z0-9_]*$'`,
      `CONSTRAINT "service_field_options_value_format_check" CHECK ("value" ~ '^[A-Z][A-Z0-9_]*$'`,
    ]) {
      expect(migrationSql).toContain(check);
    }
  });

  it("enforces positive versions and non-negative display positions", () => {
    expect(migrationSql).toContain(
      `CONSTRAINT "service_categories_version_positive_check" CHECK ("version" > 0)`,
    );
    expect(migrationSql).toContain(
      `CONSTRAINT "services_version_positive_check" CHECK ("version" > 0)`,
    );
    for (const table of [
      "service_categories",
      "services",
      "service_price_units",
      "service_fields",
      "service_field_options",
      "service_media_associations",
    ]) {
      expect(migrationSql).toContain(
        `CONSTRAINT "${table}_display_order_nonneg_check" CHECK ("display_order" >= 0)`,
      );
    }
  });

  it("enforces the exact uniqueness contract for codes, positions, locales, and media", () => {
    expectUniqueIndex("service_categories_code_key", "service_categories", ["code"]);
    expectUniqueIndex("service_categories_display_order_key", "service_categories", [
      "display_order",
    ]);
    expectUniqueIndex("services_code_key", "services", ["code"]);
    expectUniqueIndex("services_category_id_display_order_key", "services", [
      "category_id",
      "display_order",
    ]);
    expectUniqueIndex(
      "service_translations_service_id_locale_key",
      "service_translations",
      ["service_id", "locale"],
    );
    expectUniqueIndex("service_price_units_service_id_code_key", "service_price_units", [
      "service_id",
      "code",
    ]);
    expectUniqueIndex(
      "service_price_units_service_id_display_order_key",
      "service_price_units",
      ["service_id", "display_order"],
    );
    expectUniqueIndex("service_fields_service_id_code_key", "service_fields", [
      "service_id",
      "code",
    ]);
    expectUniqueIndex("service_fields_service_id_display_order_key", "service_fields", [
      "service_id",
      "display_order",
    ]);
    expectUniqueIndex(
      "service_field_options_service_field_id_value_key",
      "service_field_options",
      ["service_field_id", "value"],
    );
    expectUniqueIndex(
      "service_field_options_service_field_id_display_order_key",
      "service_field_options",
      ["service_field_id", "display_order"],
    );
    expectUniqueIndex(
      "service_country_availability_service_id_country_id_key",
      "service_country_availability",
      ["service_id", "country_id"],
    );
    expectUniqueIndex(
      "service_media_associations_media_file_id_key",
      "service_media_associations",
      ["media_file_id"],
    );
    expectUniqueIndex(
      "service_media_associations_service_id_display_order_key",
      "service_media_associations",
      ["service_id", "display_order"],
    );
    expectUniqueIndex(
      "catalog_command_requests_actor_scope_idempotency_key",
      "catalog_command_requests",
      ["actor_user_id", "scope_key", "idempotency_key"],
    );
  });

  it("keeps each field-kind's incompatible columns null and INFORMATION never required", () => {
    expect(migrationSql).toContain(
      `CONSTRAINT "service_fields_information_required_check" CHECK (
    ("kind" <> 'INFORMATION') OR ("is_required" = false)
  )`,
    );
    expect(migrationSql).toContain(
      `CONSTRAINT "service_fields_text_bounds_check" CHECK (
    ("kind" = 'TEXT')
    OR ("min_length" IS NULL AND "max_length" IS NULL)
  )`,
    );
    expect(migrationSql).toContain(
      `CONSTRAINT "service_fields_number_mode_check" CHECK (
    (("kind" = 'NUMBER') AND ("number_mode" IS NOT NULL))
    OR (("kind" <> 'NUMBER') AND ("number_mode" IS NULL AND "min_value" IS NULL AND "max_value" IS NULL))
  )`,
    );
    expect(migrationSql).toContain(
      `CONSTRAINT "service_fields_selection_bounds_kind_check" CHECK (
    ("kind" = 'MULTI_SELECT')
    OR ("min_selections" IS NULL AND "max_selections" IS NULL)
  )`,
    );
  });

  it("keeps min/max bounds ordered and non-negative", () => {
    expect(migrationSql).toContain(
      `CONSTRAINT "service_fields_text_length_nonneg_check" CHECK (
    ("min_length" IS NULL OR "min_length" >= 0)
    AND ("max_length" IS NULL OR "max_length" >= 0)
  )`,
    );
    expect(migrationSql).toContain(`"max_length" >= "min_length"`);
    expect(migrationSql).toContain(`"max_value" >= "min_value"`);
    expect(migrationSql).toContain(
      `CONSTRAINT "service_fields_selection_bounds_nonneg_check" CHECK (
    ("min_selections" IS NULL OR "min_selections" >= 0)
    AND ("max_selections" IS NULL OR "max_selections" >= 0)
  )`,
    );
    expect(migrationSql).toContain(`"max_selections" >= "min_selections"`);
  });

  it("keeps command receipts internally valid for PENDING and COMPLETED states", () => {
    expect(migrationSql).toContain(
      `CONSTRAINT "catalog_command_requests_hash_format_check" CHECK ("request_hash" ~ '^[a-f0-9]{64}$')`,
    );
    const shape = migrationSql.match(
      /CONSTRAINT "catalog_command_requests_completed_shape_check" CHECK \(([\s\S]*?)\n\s*\)\n\);/u,
    );
    expect(shape).not.toBeNull();
    const body = shape?.[1] ?? "";
    expect(body).toContain("'COMPLETED'");
    expect(body).toContain(`"completed_at" IS NOT NULL`);
    expect(body).toContain(`"accepted_version" > 0`);
    expect(body).toContain("'PENDING'");
    expect(body).toContain(`"completed_at" IS NULL`);
    expect(body).toContain(`"reserved_media_file_id" IS NOT NULL`);
  });

  it("declares the supporting selectability indexes", () => {
    for (const index of [
      `CREATE INDEX "services_category_id_is_active_display_order_idx" ON "services"("category_id", "is_active", "display_order")`,
      `CREATE INDEX "service_country_availability_country_id_is_available_service_id_idx" ON "service_country_availability"("country_id", "is_available", "service_id")`,
      `CREATE INDEX "service_country_availability_service_id_is_available_idx" ON "service_country_availability"("service_id", "is_available")`,
      `CREATE INDEX "catalog_command_requests_actor_user_id_created_at_idx" ON "catalog_command_requests"("actor_user_id", "created_at")`,
    ]) {
      expect(migrationSql).toContain(index);
    }
  });

  it("declares decimal-safe numeric bounds and no price amount column", () => {
    expect(migrationSql).toMatch(/"min_value" DECIMAL\(18,3\)/u);
    expect(migrationSql).toMatch(/"max_value" DECIMAL\(18,3\)/u);
    expect(migrationSql).not.toMatch(/\bDOUBLE PRECISION\b/u);
    expect(migrationSql).not.toMatch(/"amount"|"currency_id"|"price"/u);
    expect(schema).toMatch(/minValue\s+Decimal\?\s+@map\("min_value"\) @db\.Decimal\(18, 3\)/u);
  });

  it("adds no Catalog column to the Media-owned table", () => {
    expect(migrationSql).not.toMatch(/ALTER TABLE "media_files" ADD COLUMN/u);
  });
});

describe.skipIf(approvedLiveTarget === null)(
  "R1-P08 migration constraint contract (live, owner-approved target only)",
  () => {
    it("rejects malformed command hashes and invalid PENDING/COMPLETED shapes", async () => {
      const {
        createConnectedMigrationProofCatalogClient,
        ensureR1P08CatalogDatabaseMigrated,
      } = await import("../../helpers/r1-p08-catalog-live.js");
      const { expectR1P07ConstraintRejection } = await import(
        "../../../scripts/validate-clean-migration.js"
      );
      const connectionString = approvedLiveTarget!;
      await ensureR1P08CatalogDatabaseMigrated(connectionString);
      const prisma = await createConnectedMigrationProofCatalogClient(connectionString);
      try {
        const service = await prisma.service.findFirst({
          select: { id: true },
        });
        const serviceId = service?.id ?? "r1p08-live-service";

        await expectR1P07ConstraintRejection("a malformed command hash", "23514", () =>
          prisma.$executeRawUnsafe(`
            INSERT INTO "catalog_command_requests" (
              "id", "actor_user_id", "scope_key", "idempotency_key", "request_hash", "status",
              "target_type", "reserved_media_file_id", "updated_at"
            ) VALUES (
              'r1p08-live-invalid-hash', 'r1p08-live-actor', 'service:${serviceId}',
              'r1p08-live-invalid-hash', 'not-a-sha256', 'PENDING', 'SERVICE',
              'r1p08-live-media', CURRENT_TIMESTAMP
            )
          `));

        await expectR1P07ConstraintRejection(
          "a PENDING command without reserved media identity",
          "23514",
          () =>
            prisma.$executeRawUnsafe(`
              INSERT INTO "catalog_command_requests" (
                "id", "actor_user_id", "scope_key", "idempotency_key", "request_hash", "status",
                "target_type", "updated_at"
              ) VALUES (
                'r1p08-live-pending-missing-media', 'r1p08-live-actor', 'service:${serviceId}',
                'r1p08-live-pending-missing-media', repeat('b', 64), 'PENDING', 'SERVICE',
                CURRENT_TIMESTAMP
              )
            `),
        );

        await expectR1P07ConstraintRejection(
          "a completed command without completion facts",
          "23514",
          () =>
            prisma.$executeRawUnsafe(`
              INSERT INTO "catalog_command_requests" (
                "id", "actor_user_id", "scope_key", "idempotency_key", "request_hash", "status",
                "target_type", "updated_at"
              ) VALUES (
                'r1p08-live-invalid-completed', 'r1p08-live-actor', 'service:${serviceId}',
                'r1p08-live-invalid-completed', repeat('a', 64), 'COMPLETED', 'SERVICE',
                CURRENT_TIMESTAMP
              )
            `),
        );
      } finally {
        await prisma.$disconnect();
      }
    });
  },
);
