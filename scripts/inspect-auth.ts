import { z } from "zod";

const pg = require("pg") as typeof import("pg");

const scriptEnvironment = z
  .object({ DATABASE_URL: z.string().min(1, "DATABASE_URL is required") })
  .parse(process.env);

const FOUNDATION_TABLES = [
  "currencies",
  "countries",
  "app_configs",
  "country_configs",
  "audit_logs",
] as const;
const AUTH_TABLES = [
  "users",
  "user_credentials",
  "user_sessions",
  "otp_codes",
  "password_reset_tokens",
  "social_accounts",
  "auth_events",
] as const;
const AUTH_POLICY_KEYS = [
  "auth.signin_policy",
  "auth.verification_policy",
  "auth.recovery_policy",
  "auth.endpoint_limits",
] as const;

/** Inspect only schema inventory, migration names, and non-secret config keys. */
async function inspectAuthSchema(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: scriptEnvironment.DATABASE_URL,
    max: 1,
  });

  try {
    const expectedTables = [...FOUNDATION_TABLES, ...AUTH_TABLES];
    const [tablesResult, policiesResult, migrationsResult] = await Promise.all([
      pool.query<{ readonly table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])
         ORDER BY table_name`,
        [expectedTables],
      ),
      pool.query<{ readonly key: string }>(
        `SELECT key FROM app_configs WHERE key = ANY($1::text[]) ORDER BY key`,
        [[...AUTH_POLICY_KEYS]],
      ),
      pool.query<{ readonly migration_name: string }>(
        `SELECT migration_name FROM _prisma_migrations
         WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
         ORDER BY started_at`,
      ),
    ]);
    const presentTables = new Set(tablesResult.rows.map((row) => row.table_name));
    const presentPolicies = new Set(policiesResult.rows.map((row) => row.key));

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          phase: "R1-P02",
          foundationTables: {
            present: FOUNDATION_TABLES.filter((table) => presentTables.has(table)),
            missing: FOUNDATION_TABLES.filter((table) => !presentTables.has(table)),
          },
          authenticationTables: {
            present: AUTH_TABLES.filter((table) => presentTables.has(table)),
            missing: AUTH_TABLES.filter((table) => !presentTables.has(table)),
          },
          authenticationPolicyKeys: {
            present: AUTH_POLICY_KEYS.filter((key) => presentPolicies.has(key)),
            missing: AUTH_POLICY_KEYS.filter((key) => !presentPolicies.has(key)),
          },
          appliedMigrations: migrationsResult.rows.map((row) => row.migration_name),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end();
  }
}

void inspectAuthSchema().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: "AUTH_SCHEMA_INSPECTION_FAILED",
      errorName: error instanceof Error ? error.name : "UnknownError",
    })}\n`,
  );
  process.exitCode = 1;
});
