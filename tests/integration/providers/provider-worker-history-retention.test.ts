import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createMigrationProofPrismaClient } from "../../../scripts/validate-clean-migration.js";
import { hasExplicitR1P07TestDatabase } from "../../helpers/r1-p07-workforce-fixtures.js";

const databaseUrl = hasExplicitR1P07TestDatabase() ? process.env["TEST_DATABASE_URL"] : undefined;
const databaseDescribe = databaseUrl === undefined ? describe.skip : describe.sequential;

function fixture(prefix: string) {
  return {
    userId: `${prefix}-user`,
    providerId: `${prefix}-provider`,
    workerId: `${prefix}-worker`,
    historyId: `${prefix}-history`,
  };
}

async function insertHistoryFixture(
  transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  ids: ReturnType<typeof fixture>,
): Promise<void> {
  await transaction.$executeRawUnsafe(`
    INSERT INTO "users" (
      "id", "email_normalized", "account_categories", "verified_categories", "status", "updated_at"
    ) VALUES (
      '${ids.userId}', '${ids.userId}@example.invalid', ARRAY[]::"AccountCategory"[],
      ARRAY[]::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP
    );
    INSERT INTO "providers" (
      "id", "application_owner_user_id", "owner_user_id", "kind", "application_status",
      "operational_status", "approved_at", "updated_at"
    ) VALUES (
      '${ids.providerId}', '${ids.userId}', '${ids.userId}', 'INDIVIDUAL_TEAM',
      'APPROVED', 'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO "provider_workers" (
      "id", "provider_id", "identity_user_id", "status", "ended_at", "updated_at"
    ) VALUES (
      '${ids.workerId}', '${ids.providerId}', '${ids.userId}', 'REMOVED',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    INSERT INTO "provider_worker_profiles" (
      "worker_id", "full_legal_name", "gender", "operational_phone_e164", "worker_type", "updated_at"
    ) VALUES (
      '${ids.workerId}', 'Synthetic Retained Worker', 'FEMALE', '+201000001370',
      'CLEANING_STAFF', CURRENT_TIMESTAMP
    );
    INSERT INTO "provider_workforce_history" (
      "id", "provider_id", "target_type", "target_id", "target_version", "event_code",
      "actor_user_id", "safe_before", "safe_after", "request_id"
    ) VALUES (
      '${ids.historyId}', '${ids.providerId}', 'WORKER', '${ids.workerId}', 2,
      'WORKER_REMOVED', '${ids.userId}', '{"status":"ACTIVE","version":1}'::jsonb,
      '{"status":"REMOVED","version":2}'::jsonb, '${ids.historyId}-request'
    );
  `);
}

databaseDescribe("R1-P07 Worker history database retention", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    if (databaseUrl === undefined) throw new Error("Explicit R1-P07 TEST_DATABASE_URL is required");
    prisma = createMigrationProofPrismaClient(databaseUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("retains safe immutable history independently of a deleted engagement row", async () => {
    const ids = fixture(`r1p07-history-retention-${process.pid}-${Date.now()}`);
    await expect(prisma.$transaction(async (transaction) => {
      await insertHistoryFixture(transaction, ids);
      await transaction.$executeRawUnsafe(`DELETE FROM "provider_worker_profiles" WHERE "worker_id" = '${ids.workerId}'`);
      await transaction.$executeRawUnsafe(`DELETE FROM "provider_workers" WHERE "id" = '${ids.workerId}'`);
      const rows = await transaction.$queryRawUnsafe<Array<{ target_id: string; safe_after: unknown }>>(`
        SELECT target_id::text AS target_id, safe_after
        FROM "provider_workforce_history" WHERE "id" = '${ids.historyId}'
      `);
      expect(rows).toEqual([{
        target_id: ids.workerId,
        safe_after: { status: "REMOVED", version: 2 },
      }]);
      throw new Error("ROLLBACK_R1_P07_HISTORY_RETENTION_FIXTURE");
    })).rejects.toThrow("ROLLBACK_R1_P07_HISTORY_RETENTION_FIXTURE");
  });

  it.each(["UPDATE", "DELETE"] as const)("rejects application %s of the immutable history ledger", async (operation) => {
    const ids = fixture(`r1p07-history-immutable-${operation.toLowerCase()}-${process.pid}-${Date.now()}`);
    await expect(prisma.$transaction(async (transaction) => {
      await insertHistoryFixture(transaction, ids);
      if (operation === "UPDATE") {
        await transaction.$executeRawUnsafe(`
          UPDATE "provider_workforce_history" SET "event_code" = 'MUTATED'
          WHERE "id" = '${ids.historyId}'
        `);
      } else {
        await transaction.$executeRawUnsafe(`DELETE FROM "provider_workforce_history" WHERE "id" = '${ids.historyId}'`);
      }
    })).rejects.toThrow(/provider_workforce_history_immutable/u);
  });
});
