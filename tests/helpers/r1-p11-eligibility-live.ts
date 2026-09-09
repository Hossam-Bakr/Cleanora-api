/**
 * Disposable-DB harness for R1-P11 live proofs.
 * Never falls back to DATABASE_URL; requires CLEANORA_R1_P11_DATABASE_URL.
 */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { seed } from "../../prisma/seed.js";
import { bindPrismaClient, resetPrismaClientForTests } from "../../src/database/prisma.js";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaProviderIdentityReader } from "../../src/modules/authentication/infrastructure/prisma-provider-identity.reader.js";
import { PrismaProviderServiceStaffAuthorizer } from "../../src/modules/authentication/infrastructure/prisma-r1-p06-security.adapters.js";
import { CatalogService } from "../../src/modules/catalog/catalog.service.js";
import {
  createCatalogDefinitionReader,
  createTransactionalCatalogDefinitionReaderFactory,
} from "../../src/modules/catalog/catalog.public.js";
import {
  createTransactionalActiveCountryReader,
  createTransactionalCountryTimeZoneReader,
  createTransactionalLocalityReader,
  createTransactionalProviderServicePricingPolicyReader,
} from "../../src/modules/configuration/configuration.public.js";
import { createEligibilityApplicationService } from "../../src/modules/eligibility/eligibility.service.js";
import { EligibilityUnitOfWork } from "../../src/modules/eligibility/infrastructure/eligibility.unit-of-work.js";
import {
  withProviderAvailabilityReadTransaction,
  withProviderAvailabilityWriteTransaction,
} from "../../src/modules/providers/infrastructure/prisma-provider-availability.repository.js";
import { PrismaProviderServiceUnitOfWork } from "../../src/modules/providers/infrastructure/prisma-provider-service.unit-of-work.js";
import { ProviderAvailabilityService } from "../../src/modules/providers/provider-availability.service.js";
import { ProviderCapacityService } from "../../src/modules/providers/provider-capacity.service.js";
import { ProviderServiceService } from "../../src/modules/providers/provider-service.service.js";
import { ProviderWorkerAvailabilityService } from "../../src/modules/providers/provider-worker-availability.service.js";
import {
  createBoundEligibilityAvailabilityReader,
  createBoundEligibilityPricingReader,
  createBoundEligibilityProviderLifecycleReader,
  createTransactionalEligibilityAvailabilityReaderFactory,
  createTransactionalEligibilityPricingReaderFactory,
  createTransactionalEligibilityProviderLifecycleReaderFactory,
} from "../../src/modules/providers/providers.public.js";
import { createLiveCatalogRepository } from "./r1-p08-catalog-live.js";
import { createActiveProviderWorker } from "./r1-p10-availability-live.js";
import { requireR1P11ProofDatabaseUrl } from "./r1-p11-eligibility-fixtures.js";
import { TestLogger } from "./test-logger.js";

/** Monday 08:00–10:00 Africa/Cairo (UTC+2 in January). */
export const R1_P11_LIVE_INTERVAL = {
  startsAt: "2027-01-04T06:00:00.000Z",
  endsAt: "2027-01-04T08:00:00.000Z",
  evaluatedAt: "2027-01-04T05:00:00.000Z",
} as const;

const MONDAY_MORNING_PERIOD = {
  weekday: 1 as const,
  startMinute: 480,
  endMinute: 720,
  endsNextDay: false,
};

let seedOnce: Promise<void> | null = null;

function preferDirectConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace("-pooler", "");
    return parsed.toString();
  } catch {
    return url;
  }
}

export type R1P11LiveDb = {
  readonly db: PrismaClient;
  readonly countryId: string;
  close(): Promise<void>;
};

/**
 * @desc Idempotent seed of EG/catalog/auth/rule-version on the P11 proof DB.
 * @access Test helper
 */
async function ensureR1P11Seeded(db: PrismaClient): Promise<void> {
  if (seedOnce === null) {
    seedOnce = (async () => {
      await seed(db);
    })().catch((error: unknown) => {
      seedOnce = null;
      throw error;
    });
  }
  await seedOnce;
}

/**
 * @desc Open a Prisma client against the approved Phase 11 disposable database.
 * @access Test helper
 * @explanation Seeds reference data when missing. Cleans disposable eligibility
 * evaluation trees between uses; never deletes the seeded rule version.
 */
export async function openR1P11LiveDb(): Promise<R1P11LiveDb> {
  const url = preferDirectConnectionString(
    requireR1P11ProofDatabaseUrl(process.env),
  );
  resetPrismaClientForTests("test");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 8 }),
  });
  await db.$connect();
  bindPrismaClient(db);
  await ensureR1P11Seeded(db);

  const country = await db.country.findUniqueOrThrow({
    where: { code: "EG" },
    select: { id: true },
  });

  await db.eligibilityEvaluation.deleteMany({});

  return {
    db,
    countryId: country.id,
    async close() {
      await db.$disconnect();
      resetPrismaClientForTests("test");
    },
  };
}

async function currentWorkerVersion(
  db: PrismaClient,
  workerId: string,
): Promise<number> {
  const row = await db.providerWorker.findUniqueOrThrow({
    where: { id: workerId },
    select: { version: true },
  });
  return row.version;
}

/**
 * @desc Compose Eligibility the same way `src/composition.ts` does.
 * @access Test helper
 */
export function createComposedEligibilityService(
  db: PrismaClient,
  catalogService: CatalogService,
) {
  const eligibilityUnitOfWork = new EligibilityUnitOfWork(db, {
    maxWaitMs: 120_000,
    timeoutMs: 120_000,
  });
  return createEligibilityApplicationService({
    unitOfWork: eligibilityUnitOfWork,
    clock: () => new Date(R1_P11_LIVE_INTERVAL.evaluatedAt),
    createCatalogReader: createTransactionalCatalogDefinitionReaderFactory(
      (transaction) => catalogService.forTransaction(transaction),
    ),
    createActiveCountryReader: createTransactionalActiveCountryReader,
    createLocalityReader: createTransactionalLocalityReader,
    createCountryTimeZoneReader: createTransactionalCountryTimeZoneReader,
    createPricingReader: createTransactionalEligibilityPricingReaderFactory(
      (transaction) =>
        createBoundEligibilityPricingReader(
          transaction,
          catalogService.forTransaction(transaction),
        ),
    ),
    createLifecycleReader:
      createTransactionalEligibilityProviderLifecycleReaderFactory((transaction) =>
        createBoundEligibilityProviderLifecycleReader(transaction),
      ),
    createAvailabilityReader:
      createTransactionalEligibilityAvailabilityReaderFactory((transaction) =>
        createBoundEligibilityAvailabilityReader(transaction),
      ),
  });
}

/**
 * @desc Real P08/P09/P10-backed Eligibility fixture on the disposable P11 DB.
 * @access Test helper
 */
export async function createR1P11EligibilityLiveHarness() {
  const live = await openR1P11LiveDb();
  const { db, countryId } = live;
  const country = await db.country.findUniqueOrThrow({ where: { id: countryId } });

  const catalogService = new CatalogService({
    repository: createLiveCatalogRepository(db),
    logger: new TestLogger(),
    authorization: { authorizeProtectedOperation: async () => ({ allowed: true }) },
  });

  const owner = await db.user.create({
    data: {
      emailNormalized: `r1p11-${randomUUID()}@example.invalid`,
      status: "ACTIVE",
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
      emailVerifiedAt: new Date(),
    },
  });
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

  const provider = await db.provider.create({
    data: {
      applicationOwnerUserId: owner.id,
      ownerUserId: owner.id,
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      approvedAt: new Date(),
      operationalStatus: "LIVE",
      profile: {
        create: {
          countryId: country.id,
          displayNameAr: "اختبار أهلية",
          displayNameEn: "R1-P11 eligibility fixture",
        },
      },
      members: {
        create: {
          userId: owner.id,
          level: "OWNER",
          status: "ACTIVE",
          enabledAt: new Date(),
        },
      },
    },
  });

  await db.countryConfig.upsert({
    where: {
      countryId_key: {
        countryId: country.id,
        key: "providers.service_pricing_policy",
      },
    },
    create: {
      countryId: country.id,
      key: "providers.service_pricing_policy",
      valueKind: "OBJECT",
      value: { approvalRequired: false, maximumPrice: "9999.99" },
    },
    update: { value: { approvalRequired: false, maximumPrice: "9999.99" } },
  });

  const selectable = await catalogService.listSelectable({
    countryCode: "EG",
    locale: "EN",
    limit: 100,
  });
  const firstSelectable = selectable.items[0];
  if (firstSelectable === undefined) {
    throw new Error("P11 live harness requires a seeded selectable Catalog service");
  }
  const definition = await catalogService.getSnapshotReadyDefinition({
    serviceCode: firstSelectable.serviceCode,
    countryCode: "EG",
    locale: "EN",
  });
  if (definition === null) {
    throw new Error("P11 live harness missing snapshot-ready Catalog definition");
  }
  const catalogPriceUnitId = definition.priceUnits[0]?.id;
  if (catalogPriceUnitId === undefined) {
    throw new Error("P11 live harness Catalog definition has no price unit");
  }

  const staffAuthorizer = new PrismaProviderServiceStaffAuthorizer(db);
  const identityReader = createPrismaProviderIdentityReader(db);
  const uow = new PrismaProviderServiceUnitOfWork(
    (tx) => createCatalogDefinitionReader(catalogService.forTransaction(tx)),
    createTransactionalProviderServicePricingPolicyReader,
    (tx) => new PrismaProviderServiceStaffAuthorizer(tx),
    (tx) => ({
      append: async (input) =>
        createPrismaGeneralTransactionalAuditWriter(tx).append(input),
    }),
    db,
    { maxWaitMs: 120_000, timeoutMs: 120_000 },
  );
  const commands = new ProviderServiceService({
    unitOfWork: uow,
    identityReader,
    staffAuthorizer,
  });
  const created = await commands.createOffering({
    actorUserId: owner.id,
    providerId: provider.id,
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
    expectedVersion: 0,
    catalogServiceCode: definition.serviceCode,
    catalogPriceUnitId,
    price: "120.00",
    minimumCharge: "150.00",
    estimatedDurationMinutes: 90,
    noteAr: "ملاحظة أهلية",
    noteEn: "Eligibility offering",
  });
  await commands.applyLifecycle({
    actorUserId: owner.id,
    providerId: provider.id,
    providerServiceId: created.offering.id,
    requestId: randomUUID(),
    idempotencyKey: randomUUID(),
    expectedVersion: created.offering.version,
    action: "ENABLE",
    reason: "Enable P11 eligibility fixture offering",
  });

  const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const city = await db.city.create({
    data: {
      countryId: country.id,
      code: `P11${suffix}`.slice(0, 12),
      nameAr: `مدينة أهلية ${suffix}`,
      nameEn: `P11 City ${suffix}`,
    },
  });
  const district = await db.district.create({
    data: {
      cityId: city.id,
      code: `D${suffix}`.slice(0, 12),
      nameAr: `حي أهلية ${suffix}`,
      nameEn: `P11 District ${suffix}`,
    },
  });

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

  const coverage = await availabilityService.replaceCoverage(
    { actorUserId: owner.id },
    provider.id,
    {
      selections: [{ type: "DISTRICT", id: district.id }],
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    },
  );
  await availabilityService.replaceCalendar(
    { actorUserId: owner.id },
    provider.id,
    {
      weeklyPeriods: [MONDAY_MORNING_PERIOD],
      exceptions: [],
      expectedVersion: coverage.coverage.version,
      idempotencyKey: randomUUID(),
    },
  );
  await capacityService.replaceCapacityRule(
    { actorUserId: owner.id },
    provider.id,
    {
      maxSimultaneousTeams: 1,
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
    },
  );

  const worker = await createActiveProviderWorker(db, provider.id);
  await workerAvailabilityService.replaceWorkerCalendar(
    { actorUserId: owner.id },
    provider.id,
    worker.id,
    {
      weeklyPeriods: [MONDAY_MORNING_PERIOD],
      exceptions: [],
      expectedVersion: await currentWorkerVersion(db, worker.id),
      idempotencyKey: randomUUID(),
    },
  );
  const team = await db.providerTeam.create({
    data: {
      providerId: provider.id,
      status: "ACTIVE",
      name: `P11 team ${suffix}`,
      normalizedName: `p11 team ${suffix.toLowerCase()}`,
      memberships: {
        create: [{ workerId: worker.id, cleans: true }],
      },
    },
  });

  const eligibility = createComposedEligibilityService(db, catalogService);

  return {
    ...live,
    country,
    owner,
    provider,
    worker,
    team,
    city,
    district,
    catalogServiceId: definition.serviceId,
    catalogServiceCode: definition.serviceCode,
    eligibility,
    requestBase: {
      serviceId: definition.serviceId,
      countryId: country.id,
      cityId: city.id,
      districtId: district.id,
      startsAt: R1_P11_LIVE_INTERVAL.startsAt,
      endsAt: R1_P11_LIVE_INTERVAL.endsAt,
      crewPreference: "any" as const,
      requiredTeamUnits: 1,
    },
  };
}

export type R1P11EligibilityLiveHarness = Awaited<
  ReturnType<typeof createR1P11EligibilityLiveHarness>
>;
