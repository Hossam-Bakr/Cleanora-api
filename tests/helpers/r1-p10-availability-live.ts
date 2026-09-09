import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "../../src/database/prisma.js";
import { requireR1P10ProofDatabaseUrl } from "./r1-p10-availability-fixtures.js";
import { createPrismaLocalityRepository, withLocalityTransaction } from "../../src/modules/configuration/infrastructure/prisma-locality.repository.js";
import { LocalityService } from "../../src/modules/configuration/locality.service.js";
import { createLocalityRouter } from "../../src/modules/configuration/locality.routes.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import {
  withProviderAvailabilityReadTransaction,
  withProviderAvailabilityWriteTransaction,
} from "../../src/modules/providers/infrastructure/prisma-provider-availability.repository.js";
import { ProviderAvailabilityService } from "../../src/modules/providers/provider-availability.service.js";
import { ProviderCapacityService } from "../../src/modules/providers/provider-capacity.service.js";
import { ProviderOperationalAvailabilityService } from "../../src/modules/providers/provider-operational-availability.service.js";
import { ProviderWorkerAvailabilityService } from "../../src/modules/providers/provider-worker-availability.service.js";
import { createProviderAvailabilityRouter } from "../../src/modules/providers/provider-availability.routes.js";
import { createTestApp } from "./create-test-app.js";
import { createTestEnvironment } from "./test-environment.js";
import { TestLogger } from "./test-logger.js";

/**
 * Second Provider Admin actor for cross-actor idempotency proofs.
 * Providers allow only one OWNER membership; Admin + provider_admin role is correct.
 */
export async function createSecondProviderAdminActor(
  db: PrismaClient,
  providerId: string,
) {
  const user = await db.user.create({
    data: {
      emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
      status: "ACTIVE",
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
      emailVerifiedAt: new Date(),
    },
  });
  await db.providerMember.create({
    data: {
      providerId,
      userId: user.id,
      level: "ADMIN",
      status: "ACTIVE",
      enabledAt: new Date(),
    },
  });
  const providerAdminRole = await db.role.findUniqueOrThrow({
    where: { code: "provider_admin" },
  });
  await db.userRole.create({
    data: {
      userId: user.id,
      roleId: providerAdminRole.id,
      status: "ENABLED",
      enabledAt: new Date(),
    },
  });
  return user;
}

/** Prefer the direct Neon host for interactive transactions (avoid pooler). */
function preferDirectConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace("-pooler", "");
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * ACTIVE workers require a profile row (R1-P07 `provider_worker_profile_missing`).
 * Use this for every live ACTIVE worker fixture.
 */
export async function createActiveProviderWorker(
  db: PrismaClient,
  providerId: string,
  options?: {
    readonly workerType?: "CLEANING_STAFF" | "ESCORT";
    readonly fullLegalName?: string;
  },
) {
  const suffix = randomUUID().replaceAll(/\D/gu, "").slice(0, 8).padEnd(8, "0");
  return db.providerWorker.create({
    data: {
      providerId,
      status: "ACTIVE",
      profile: {
        create: {
          fullLegalName: options?.fullLegalName ?? `R1-P10 Worker ${suffix}`,
          gender: "FEMALE",
          operationalPhoneE164: `+2010${suffix}`,
          workerType: options?.workerType ?? "CLEANING_STAFF",
        },
      },
    },
  });
}

/** Real persisted participants for R1-P10 locality and availability proofs. */
export async function createR1P10AvailabilityLiveHarness() {
  const url = preferDirectConnectionString(
    requireR1P10ProofDatabaseUrl(process.env),
  );
  resetPrismaClientForTests("test");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 8 }),
  });
  await db.$connect();
  bindPrismaClient(db);

  // Best-effort wipe of mutable locality/coverage fixtures. Prefer unique codes
  // in tests; cleanup must not fail the harness if Neon drops mid-suite.
  try {
    await db.providerCoverageArea.deleteMany({});
    await db.providerScheduleException.deleteMany({});
    await db.providerSchedule.deleteMany({});
    await db.workerScheduleException.deleteMany({});
    await db.workerSchedule.deleteMany({});
    await db.providerTemporaryPause.deleteMany({});
    await db.providerCapacityRule.deleteMany({});
    await db.district.deleteMany({});
    await db.city.deleteMany({});
  } catch {
    await db.$connect();
  }

  const countryRow = await db.country.findUniqueOrThrow({ where: { code: "EG" } });
  const country =
    countryRow.isActive === true
      ? countryRow
      : await db.country.update({
          where: { id: countryRow.id },
          data: { isActive: true },
        });

  const staffAdmin = await db.user.create({
    data: {
      emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
      status: "ACTIVE",
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      emailVerifiedAt: new Date(),
    },
  });
  const staffAdminRole = await db.role.findUniqueOrThrow({ where: { code: "staff_admin" } });
  await db.userRole.create({
    data: { userId: staffAdmin.id, roleId: staffAdminRole.id, status: "ENABLED", enabledAt: new Date() },
  });

  const owner = await db.user.create({
    data: {
      emailNormalized: `r1p10-${randomUUID()}@example.invalid`,
      status: "ACTIVE",
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
      emailVerifiedAt: new Date(),
    },
  });
  const provider = await db.provider.create({
    data: {
      applicationOwnerUserId: owner.id,
      ownerUserId: owner.id,
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      approvedAt: new Date(),
      profile: { create: { countryId: country.id, displayNameAr: "اختبار", displayNameEn: "R1-P10 fixture" } },
      members: { create: { userId: owner.id, level: "OWNER", status: "ACTIVE", enabledAt: new Date() } },
    },
  });
  const worker = await createActiveProviderWorker(db, provider.id);
  // Mirrors provider-approval.service.ts's grantOwnerAuthority: the real
  // approval flow enables the global `provider_admin` role for the Owner.
  // Repair item 2 makes resolveAuthorityFacts read this role directly rather
  // than trusting a hardcoded `true`, so the fixture must grant it for real.
  const providerAdminRole = await db.role.findUniqueOrThrow({
    where: { code: "provider_admin" },
  });
  await db.userRole.create({
    data: {
      userId: owner.id,
      roleId: providerAdminRole.id,
      status: "ENABLED",
      enabledAt: new Date(),
    },
  });

  const localityService = new LocalityService({
    authorization: { authorizeProtectedOperation: async () => ({ allowed: true }) },
    repository: createPrismaLocalityRepository(db),
    runInTransaction: (work) =>
      withLocalityTransaction((tx, repository) =>
        work(repository, createPrismaGeneralTransactionalAuditWriter(tx)),
      ),
  });

  // Repair item 2: no outer, full-client authority/locality reader — every
  // read/write unit of work supplies its own transaction-bound repository
  // and `LocalityReader` from `withProviderAvailabilityWriteTransaction`/
  // `...ReadTransaction`.
  const availabilityService = new ProviderAvailabilityService({
    runInWriteTransaction: (work) => withProviderAvailabilityWriteTransaction(work),
    runInReadTransaction: (work) => withProviderAvailabilityReadTransaction(work),
  });
  const workerAvailabilityService = new ProviderWorkerAvailabilityService({
    runInWriteTransaction: (work) => withProviderAvailabilityWriteTransaction(work),
    runInReadTransaction: (work) => withProviderAvailabilityReadTransaction(work),
  });
  const capacityService = new ProviderCapacityService({
    runInWriteTransaction: (work) => withProviderAvailabilityWriteTransaction(work),
    runInReadTransaction: (work) => withProviderAvailabilityReadTransaction(work),
  });
  const operationalAvailabilityService = new ProviderOperationalAvailabilityService({
    runInReadTransaction: (work) => withProviderAvailabilityReadTransaction(work),
  });

  const app = (actorUserId: string | null = staffAdmin.id) =>
    createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      mountTestRoutes(application) {
        const authenticateAccess: import("express").RequestHandler = (
          _request,
          response,
          next,
        ) => {
          if (actorUserId !== null) {
            response.locals["authenticationPrincipal"] = { userId: actorUserId };
          }
          next();
        };
        application.use(
          "/api/v1/staff/configuration",
          createLocalityRouter({ authenticateAccess, localityService }),
        );
        application.use(
          "/api/v1/providers",
          createProviderAvailabilityRouter({
            authenticateAccess,
            service: availabilityService,
            workerAvailabilityService,
            capacityService,
          }),
        );
      },
    });

  return {
    db,
    country,
    staffAdmin,
    owner,
    provider,
    worker,
    localityService,
    availabilityService,
    workerAvailabilityService,
    capacityService,
    operationalAvailabilityService,
    app,
    close: async () => {
      await db.$disconnect();
      resetPrismaClientForTests("test");
    },
  };
}

export type R1P10AvailabilityLiveHarness = Awaited<
  ReturnType<typeof createR1P10AvailabilityLiveHarness>
>;
