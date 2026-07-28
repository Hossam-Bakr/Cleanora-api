import {
  bindPrismaClient,
  resetPrismaClientForTests
} from "../../src/integrations/database/prisma-client-accessor.js";
import { PrismaLifecycle } from "../../src/integrations/database/prisma-lifecycle.js";
import { requireApprovedTestDatabaseUrl } from "./resolve-test-database-url.js";

/** Bind one explicit lifecycle for a database-backed test composition. */
export async function startTestDatabaseLifecycle(): Promise<PrismaLifecycle> {
  const { url } = requireApprovedTestDatabaseUrl();
  const lifecycle = new PrismaLifecycle(url);
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
