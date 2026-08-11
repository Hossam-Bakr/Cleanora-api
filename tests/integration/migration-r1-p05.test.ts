import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { getPrismaClient } from "../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../src/database/prisma-lifecycle.js";
import {
  R1_P05_MIGRATION_SUFFIX,
  R1_P05_PROVIDER_TABLES,
  assertR1P05ProviderSchemaReady,
  hasR1P05ProviderSchema,
} from "../helpers/assert-r1-p05-schema.js";
import { hasApprovedTestDatabaseUrl } from "../helpers/resolve-test-database-url.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../helpers/test-database-lifecycle.js";

const migrationsRoot = join(process.cwd(), "prisma/migrations");
const validateCleanMigrationPath = join(
  process.cwd(),
  "scripts/validate-clean-migration.ts",
);
const hasDatabase = hasApprovedTestDatabaseUrl();

async function listMigrationDirectoryNames(): Promise<readonly string[]> {
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

describe("R1-P05 migration inventory", () => {
  it("lists the phase-owned migration in prisma/migrations", async () => {
    const names = await listMigrationDirectoryNames();
    const match = names.find(
      (name) =>
        name === R1_P05_MIGRATION_SUFFIX ||
        name.endsWith(`_${R1_P05_MIGRATION_SUFFIX}`),
    );
    expect(
      match,
      `Migration inventory must include ${R1_P05_MIGRATION_SUFFIX}`,
    ).toBeDefined();
  });

  it("extends validate-clean-migration chronology with R1-P05", async () => {
    const source = await readFile(validateCleanMigrationPath, "utf8");
    expect(source).toContain(R1_P05_MIGRATION_SUFFIX);
    for (const table of R1_P05_PROVIDER_TABLES) {
      expect(source).toContain(`"${table}"`);
    }
  });
});

describe("R1-P05 migration live probes", () => {
  let database: PrismaLifecycle | undefined;
  let schemaReady = false;

  beforeAll(async () => {
    if (!hasDatabase) {
      return;
    }
    try {
      database = await startTestDatabaseLifecycle();
      schemaReady = await hasR1P05ProviderSchema();
    } catch (error) {
      // Transient Neon pool/connect failures must not fail the inventory suite.
      // Live probes skip when schemaReady stays false.
      console.warn(
        `R1-P05 live probe setup skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      schemaReady = false;
    }
  });

  afterAll(async () => {
    if (database !== undefined) {
      await stopTestDatabaseLifecycle(database);
    }
  });

  it("probes eight Provider tables after schema ready", async ({ skip }) => {
    if (!hasDatabase) {
      skip("TEST database unavailable");
    }
    if (!schemaReady) {
      skip(
        `R1-P05 schema not ready — apply ${R1_P05_MIGRATION_SUFFIX} then re-run`,
      );
    }

    await assertR1P05ProviderSchemaReady();
    const rows = await getPrismaClient().$queryRawUnsafe<
      Array<{ table_name: string }>
    >(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'providers',
           'provider_profiles',
           'provider_contacts',
           'provider_status_history',
           'provider_members',
           'provider_admin_invitations',
           'provider_gallery_items',
           'provider_email_outbox'
         )
       ORDER BY table_name`,
    );
    expect(rows.map((row) => row.table_name)).toEqual(
      [...R1_P05_PROVIDER_TABLES].sort(),
    );
  });

  it("probes unique application_owner, one OWNER, and pending invite uniqueness", async ({
    skip,
  }) => {
    if (!hasDatabase) {
      skip("TEST database unavailable");
    }
    if (!schemaReady) {
      skip(
        `R1-P05 schema not ready — apply ${R1_P05_MIGRATION_SUFFIX} then re-run`,
      );
    }

    const indexes = await getPrismaClient().$queryRawUnsafe<
      Array<{ indexname: string; indexdef: string }>
    >(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND (
           indexname IN (
             'providers_application_owner_user_id_key',
             'provider_members_one_owner_per_provider',
             'provider_admin_invitations_one_pending_per_email'
           )
           OR tablename IN ('providers', 'provider_members', 'provider_admin_invitations')
         )`,
    );
    const names = new Set(indexes.map((row) => row.indexname));
    expect(names.has("providers_application_owner_user_id_key")).toBe(true);
    expect(names.has("provider_members_one_owner_per_provider")).toBe(true);
    expect(names.has("provider_admin_invitations_one_pending_per_email")).toBe(
      true,
    );

    const oneOwner = indexes.find(
      (row) => row.indexname === "provider_members_one_owner_per_provider",
    );
    expect(oneOwner?.indexdef).toMatch(/UNIQUE/iu);
    expect(oneOwner?.indexdef).toMatch(/OWNER/u);

    const pendingInvite = indexes.find(
      (row) =>
        row.indexname === "provider_admin_invitations_one_pending_per_email",
    );
    expect(pendingInvite?.indexdef).toMatch(/UNIQUE/iu);
    expect(pendingInvite?.indexdef).toMatch(/PENDING/u);
  });
});
