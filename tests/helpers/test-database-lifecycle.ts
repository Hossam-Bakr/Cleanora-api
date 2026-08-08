import {
  bindPrismaClient,
  resetPrismaClientForTests
} from "../../src/database/prisma.js";
import { PrismaLifecycle } from "../../src/database/prisma-lifecycle.js";
import { parseDatabaseName } from "./r1-p04-test-database.js";
import { requireApprovedTestDatabaseUrl } from "./resolve-test-database-url.js";

/** Bind one explicit lifecycle for a database-backed test composition. */
export async function startTestDatabaseLifecycle(options?: {
  readonly maxConnections?: number;
  /**
   * Prefer TEST_MIGRATION_DATABASE_URL (direct / non-pooler) when present and
   * when it names the same approved database as TEST_DATABASE_URL.
   * Required for high-concurrency interactive Prisma transactions (SC-008).
   */
  readonly preferDirectMigrationUrl?: boolean;
  readonly forceIpv4?: boolean;
}): Promise<PrismaLifecycle> {
  const pooled = requireApprovedTestDatabaseUrl();
  let url = pooled.url;
  if (options?.preferDirectMigrationUrl === true) {
    const direct = process.env["TEST_MIGRATION_DATABASE_URL"];
    if (typeof direct !== "string" || direct.length === 0) {
      throw new Error(
        "preferDirectMigrationUrl requires explicit TEST_MIGRATION_DATABASE_URL",
      );
    }
    const pooledName = parseDatabaseName(pooled.url);
    const directName = parseDatabaseName(direct);
    if (
      pooledName === undefined ||
      directName === undefined ||
      pooledName !== directName
    ) {
      throw new Error(
        "preferDirectMigrationUrl requires pooled and direct URLs to name the same database",
      );
    }
    url = direct;
  }
  const lifecycle = new PrismaLifecycle(url, {
    ...(options?.maxConnections === undefined
      ? {}
      : { maxConnections: options.maxConnections }),
    ...(options?.forceIpv4 === true ? { forceIpv4: true } : {}),
  });
  await lifecycle.connect();
  bindPrismaClient(lifecycle.client);
  return lifecycle;
}

/** Disconnect and clear only the explicit test binding. */
export async function stopTestDatabaseLifecycle(
  lifecycle: PrismaLifecycle
): Promise<void> {
  await lifecycle.disconnect();
  resetPrismaClientForTests("test");
}
