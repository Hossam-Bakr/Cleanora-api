import { loadPayoutKeyRings } from "../src/config/payout-data-keys.js";
import { getPrismaClient } from "../src/database/prisma.js";
import { PrismaProviderPayoutRepository } from "../src/modules/providers/infrastructure/prisma-provider-payout.repository.js";
import { ProviderPayoutKeyRotationService } from "../src/modules/providers/provider-payout-key-rotation.service.js";

type RotationAction = "START" | "RUN_BATCH" | "APPROVE_RETIREMENT";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`R1-P06 payout key rotation requires ${name}`);
  }
  return value;
}

function positiveInteger(name: string): number {
  const parsed = Number(required(name));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new Error(`${name} must be an integer from 1 through 1000`);
  }
  return parsed;
}

async function assertActiveStaffAdmin(actorUserId: string): Promise<void> {
  const active = await getPrismaClient().userRole.findFirst({
    where: {
      userId: actorUserId,
      status: "ENABLED",
      user: { status: "ACTIVE" },
      role: {
        code: "staff_admin",
        rolePermissions: {
          some: { permission: { code: "providers.payout-destinations.verify" } },
        },
      },
    },
    select: { id: true },
  });
  if (active === null) {
    throw new Error("R1-P06 payout key rotation actor is not an active Staff Admin");
  }
}

/**
 * Human-invoked, bounded R1-P06 rotation runner. It never edits environment
 * configuration or retires a key. APPROVE_RETIREMENT records human approval
 * only after the persisted run proves zero retained references.
 */
export async function runR1P06PayoutKeyRotation(): Promise<void> {
  const action = required("R1_P06_KEY_ROTATION_ACTION") as RotationAction;
  if (!["START", "RUN_BATCH", "APPROVE_RETIREMENT"].includes(action)) {
    throw new Error("R1_P06_KEY_ROTATION_ACTION is unsupported");
  }
  const actorUserId = required("R1_P06_KEY_ROTATION_STAFF_USER_ID");
  await assertActiveStaffAdmin(actorUserId);
  const service = new ProviderPayoutKeyRotationService(
    new PrismaProviderPayoutRepository(getPrismaClient()),
    loadPayoutKeyRings(),
  );

  if (action === "START") {
    const purpose = required("R1_P06_KEY_ROTATION_PURPOSE");
    if (purpose !== "ENCRYPTION" && purpose !== "LOOKUP_HMAC") {
      throw new Error("R1_P06_KEY_ROTATION_PURPOSE must be ENCRYPTION or LOOKUP_HMAC");
    }
    const fromKeyIds = required("R1_P06_KEY_ROTATION_FROM_KEY_IDS")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const run = await service.start({
      purpose,
      fromKeyIds,
      batchSize: positiveInteger("R1_P06_KEY_ROTATION_BATCH_SIZE"),
      startedByUserId: actorUserId,
      commandId: required("R1_P06_KEY_ROTATION_COMMAND_ID"),
    });
    console.info("R1-P06 payout key rotation started", {
      runId: run.id,
      purpose: run.purpose,
      status: run.status,
      version: run.version,
    });
    return;
  }

  const runId = required("R1_P06_KEY_ROTATION_RUN_ID");
  if (action === "RUN_BATCH") {
    const run = await service.runBatch(runId, actorUserId);
    console.info("R1-P06 payout key rotation batch completed", {
      runId: run.id,
      status: run.status,
      scannedCount: run.scannedCount,
      updatedCount: run.updatedCount,
      failedCount: run.failedCount,
      remainingReferenceCount: run.remainingReferenceCount,
      version: run.version,
    });
    return;
  }

  const run = await service.approveRetirement({
    runId,
    expectedVersion: positiveInteger("R1_P06_KEY_ROTATION_EXPECTED_VERSION"),
    approvedByUserId: actorUserId,
    reason: required("R1_P06_KEY_ROTATION_REASON"),
  });
  console.info("R1-P06 payout key retirement evidence approved", {
    runId: run.id,
    status: run.status,
    remainingReferenceCount: run.remainingReferenceCount,
    version: run.version,
  });
}

if (require.main === module) {
  void runR1P06PayoutKeyRotation().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "R1-P06 payout key rotation failed");
    process.exitCode = 1;
  });
}
