import { z } from "zod";

const pg = require("pg") as typeof import("pg");

const scriptEnvironment = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required")
  })
  .parse(process.env);

const AUTH_TABLES = [
  "users",
  "user_credentials",
  "user_sessions",
  "otp_codes",
  "password_reset_tokens",
  "social_accounts",
  "auth_events"
] as const;

/**
 * @desc Inspect the R1-P02 authentication schema safely.
 * @access Local developer script
 * @explanation This script lists planned auth tables that exist or are missing.
 * It does not read authentication records or any sensitive column values.
 */
async function inspectAuthSchema(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: scriptEnvironment.DATABASE_URL,
    max: 1
  });

  try {
    const result = await pool.query<{ readonly table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name
      `,
      [[...AUTH_TABLES]]
    );
    const present = new Set(result.rows.map((row) => row.table_name));

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          phase: "R1-P02",
          present: AUTH_TABLES.filter((table) => present.has(table)),
          missing: AUTH_TABLES.filter((table) => !present.has(table))
        },
        null,
        2
      )}\n`
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
      errorName: error instanceof Error ? error.name : "UnknownError"
    })}\n`
  );
  process.exitCode = 1;
});
