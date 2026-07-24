import { z } from "zod";

const pg = require("pg") as typeof import("pg");

const scriptEnvironment = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required")
  })
  .parse(process.env);

/**
 * @desc Check the configured PostgreSQL connection.
 * @access Local developer script
 * @explanation This script runs SELECT 1 and prints only safe database
 * metadata. It never prints the connection string or database contents.
 */
async function checkDatabase(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: scriptEnvironment.DATABASE_URL,
    max: 1
  });

  try {
    const result = await pool.query<{
      readonly database: string;
      readonly serverTime: Date;
    }>(
      "SELECT current_database() AS database, CURRENT_TIMESTAMP AS \"serverTime\""
    );
    const row = result.rows[0];

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        database: row?.database ?? "unknown",
        serverTime: row?.serverTime ?? null
      })}\n`
    );
  } finally {
    await pool.end();
  }
}

void checkDatabase().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: "DATABASE_CONNECTION_FAILED",
      errorName: error instanceof Error ? error.name : "UnknownError"
    })}\n`
  );
  process.exitCode = 1;
});
