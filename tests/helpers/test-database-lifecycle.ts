import {
  bindPrismaClient,
  resetPrismaClientForTests
} from "../../src/integrations/database/prisma-client-accessor.js";
import { PrismaLifecycle } from "../../src/integrations/database/prisma-lifecycle.js";

/** Bind one explicit lifecycle for a database-backed test composition. */
export async function startTestDatabaseLifecycle(): Promise<PrismaLifecycle> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required for database-backed tests");
  }

  const lifecycle = new PrismaLifecycle(connectionString);
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
