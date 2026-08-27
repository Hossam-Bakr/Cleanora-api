import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { createMigrationProofPrismaClient } from "../../../scripts/validate-clean-migration.js";
import { hasExplicitR1P07TestDatabase } from "../../helpers/r1-p07-workforce-fixtures.js";

const databaseUrl = hasExplicitR1P07TestDatabase() ? process.env["TEST_DATABASE_URL"] : undefined;
const databaseDescribe = databaseUrl === undefined ? describe.skip : describe.sequential;

databaseDescribe("R1-P07 competing current identity claim", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    if (databaseUrl === undefined) throw new Error("Explicit R1-P07 TEST_DATABASE_URL is required");
    prisma = createMigrationProofPrismaClient(databaseUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("accepts exactly one simultaneous current engagement claim and rejects the competitor", async () => {
    const prefix = `r1p07-identity-race-${process.pid}-${Date.now()}`;
    const ownerId = `${prefix}-owner`;
    const identityId = `${prefix}-identity`;
    const providerId = `${prefix}-provider`;
    const workerIds = [`${prefix}-worker-a`, `${prefix}-worker-b`] as const;

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`
          INSERT INTO "users" (
            "id", "email_normalized", "account_categories", "verified_categories", "status", "updated_at"
          ) VALUES
            ('${ownerId}', '${ownerId}@example.invalid', ARRAY[]::"AccountCategory"[], ARRAY[]::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP),
            ('${identityId}', '${identityId}@example.invalid', ARRAY[]::"AccountCategory"[], ARRAY[]::"AccountCategory"[], 'ACTIVE', CURRENT_TIMESTAMP);
          INSERT INTO "providers" (
            "id", "application_owner_user_id", "owner_user_id", "kind", "application_status",
            "operational_status", "approved_at", "updated_at"
          ) VALUES (
            '${providerId}', '${ownerId}', '${ownerId}', 'INDIVIDUAL_TEAM',
            'APPROVED', 'LIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );
          INSERT INTO "provider_workers" ("id", "provider_id", "status", "updated_at") VALUES
            ('${workerIds[0]}', '${providerId}', 'DRAFT', CURRENT_TIMESTAMP),
            ('${workerIds[1]}', '${providerId}', 'DRAFT', CURRENT_TIMESTAMP);
          INSERT INTO "provider_worker_profiles" (
            "worker_id", "full_legal_name", "gender", "operational_phone_e164", "worker_type", "updated_at"
          ) VALUES
            ('${workerIds[0]}', 'Concurrent Worker A', 'FEMALE', '+201000000491', 'CLEANING_STAFF', CURRENT_TIMESTAMP),
            ('${workerIds[1]}', 'Concurrent Worker B', 'FEMALE', '+201000000492', 'CLEANING_STAFF', CURRENT_TIMESTAMP);
        `);
      });

      const outcomes = await Promise.allSettled(workerIds.map((workerId) =>
        prisma.$transaction((transaction) => transaction.$executeRawUnsafe(`
          UPDATE "provider_workers" SET "identity_user_id" = '${identityId}', "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = '${workerId}'
        `), { maxWait: 15_000, timeout: 60_000 })));

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT id::text AS id FROM "provider_workers"
        WHERE "identity_user_id" = '${identityId}' AND "ended_at" IS NULL
      `);
      expect(rows).toHaveLength(1);
      expect(workerIds).toContain(rows[0]!.id);
    } finally {
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`DELETE FROM "provider_worker_profiles" WHERE "worker_id" IN ('${workerIds[0]}', '${workerIds[1]}')`);
        await transaction.$executeRawUnsafe(`DELETE FROM "provider_workers" WHERE "id" IN ('${workerIds[0]}', '${workerIds[1]}')`);
        await transaction.$executeRawUnsafe(`DELETE FROM "providers" WHERE "id" = '${providerId}'`);
        await transaction.$executeRawUnsafe(`DELETE FROM "users" WHERE "id" IN ('${ownerId}', '${identityId}')`);
      });
    }
  });
});
