
import { writeAudit } from "#modules/admin";
import type { PrismaLifecycle } from "../../src/integrations/database/prisma-lifecycle.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle
} from "../helpers/test-database-lifecycle.js";
import { hasApprovedTestDatabaseUrl } from "../helpers/resolve-test-database-url.js";

const hasDatabase = hasApprovedTestDatabaseUrl();
const databaseTestTimeoutMs = 15_000;

describe.skipIf(!hasDatabase)("admin audit public API", () => {
  let database: PrismaLifecycle;

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "persists foundation audit evidence through the public contract",
    async () => {
      const record = await writeAudit({
        actorType: "SYSTEM",
        action: "FOUNDATION_CHECKED",
        targetType: "foundation",
        targetId: "r1-p01",
        context: { source: "integration-test" },
        requestId: "03485d9e-72e4-4fd3-9b3a-7977d8ad187c"
      });

      expect(record).toMatchObject({
        actorType: "SYSTEM",
        action: "FOUNDATION_CHECKED",
        targetType: "foundation",
        targetId: "r1-p01",
        requestId: "03485d9e-72e4-4fd3-9b3a-7977d8ad187c"
      });
      expect(record.createdAt).toEqual(expect.any(String));
    },
    databaseTestTimeoutMs
  );

  it(
    "surfaces audit persistence failures instead of silently discarding them",
    async () => {
      await expect(
        writeAudit({
          actorType: "INVALID_AUDIT_ACTOR" as never,
          action: "FOUNDATION_CHECKED",
          targetType: "foundation"
        })
      ).rejects.toBeDefined();
    },
    databaseTestTimeoutMs
  );
});
