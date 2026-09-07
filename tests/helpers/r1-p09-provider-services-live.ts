import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { requireR1P09ProofDatabaseUrl } from "../../scripts/validate-clean-migration.js";
import { createPrismaProviderIdentityReader } from "../../src/modules/authentication/infrastructure/prisma-provider-identity.reader.js";
import { PrismaProviderServiceStaffAuthorizer } from "../../src/modules/authentication/infrastructure/prisma-r1-p06-security.adapters.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createTransactionalProviderServicePricingPolicyReader } from "../../src/modules/configuration/configuration.public.js";
import { CatalogService } from "../../src/modules/catalog/catalog.service.js";
import { createCatalogDefinitionReader } from "../../src/modules/catalog/catalog.public.js";
import { PrismaProviderServiceUnitOfWork } from "../../src/modules/providers/infrastructure/prisma-provider-service.unit-of-work.js";
import { ProviderServiceService } from "../../src/modules/providers/provider-service.service.js";
import { ProviderServiceQueryService } from "../../src/modules/providers/provider-service-query.service.js";
import { ProviderServiceSnapshotService } from "../../src/modules/providers/provider-service-snapshot.service.js";
import { createProviderServiceRouter, createStaffProviderServiceRouter } from "../../src/modules/providers/provider-service.routes.js";
import { createLiveCatalogRepository } from "./r1-p08-catalog-live.js";
import { createTestApp } from "./create-test-app.js";
import { createTestEnvironment } from "./test-environment.js";
import { TestLogger } from "./test-logger.js";

/** Real persisted participants; each test retains its own synthetic financial history. */
export async function createProviderServicesLiveHarness() {
  const url = requireR1P09ProofDatabaseUrl(process.env);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8 }) });
  await db.$connect();
  const country = await db.country.findUniqueOrThrow({ where: { code: "EG" } });
  const owner = await db.user.create({ data: {
    emailNormalized: `r1p09-${randomUUID()}@example.invalid`, status: "ACTIVE",
    accountCategories: ["PROVIDER_OWNER"], verifiedCategories: ["PROVIDER_OWNER"], emailVerifiedAt: new Date(),
  } });
  const staff = await db.user.create({ data: {
    emailNormalized: `r1p09-${randomUUID()}@example.invalid`, status: "ACTIVE",
    accountCategories: ["INDIVIDUAL"], verifiedCategories: ["INDIVIDUAL"], emailVerifiedAt: new Date(),
  } });
  for (const [userId, code] of [[owner.id, "provider_admin"], [staff.id, "staff_admin"]] as const) {
    const role = await db.role.findUniqueOrThrow({ where: { code } });
    await db.userRole.create({ data: { userId, roleId: role.id, status: "ENABLED", enabledAt: new Date() } });
  }
  const provider = await db.provider.create({ data: {
    applicationOwnerUserId: owner.id, ownerUserId: owner.id, kind: "INDIVIDUAL_TEAM",
    applicationStatus: "APPROVED", approvedAt: new Date(),
    profile: { create: { countryId: country.id, displayNameAr: "اختبار", displayNameEn: "Review fixture" } },
    members: { create: { userId: owner.id, level: "OWNER", status: "ACTIVE", enabledAt: new Date() } },
  } });
  const setPolicy = async (approvalRequired = false, maximumPrice = "9999.99") => {
    const key = "providers.service_pricing_policy";
    await db.countryConfig.upsert({
      where: { countryId_key: { countryId: country.id, key } },
      create: { countryId: country.id, key, valueKind: "OBJECT", value: { approvalRequired, maximumPrice } },
      update: { value: { approvalRequired, maximumPrice } },
    });
  };
  await setPolicy();
  const catalogService = new CatalogService({
    repository: createLiveCatalogRepository(db), logger: new TestLogger(),
    authorization: { authorizeProtectedOperation: async () => ({ allowed: true }) },
  });
  const catalog = createCatalogDefinitionReader(catalogService);
  const selectable = await catalog.listSelectable({ countryCode: "EG", locale: "EN", limit: 100 });
  const definition = await catalog.getSnapshotReadyDefinition({
    serviceCode: selectable.items[0]!.serviceCode, countryCode: "EG", locale: "EN",
  });
  if (definition === null) throw new Error("Seeded Catalog definition missing");
  const catalogPriceUnitId = definition.priceUnits[0]!.id;
  const staffAuthorizer = new PrismaProviderServiceStaffAuthorizer(db);
  const identityReader = createPrismaProviderIdentityReader(db);
  const faults = { audit: false };
  const uow = new PrismaProviderServiceUnitOfWork(
    (tx) => createCatalogDefinitionReader(catalogService.forTransaction(tx)),
    createTransactionalProviderServicePricingPolicyReader,
    (tx) => new PrismaProviderServiceStaffAuthorizer(tx),
    (tx) => ({ append: async (input) => {
      if (faults.audit) throw new Error("Injected audit failure");
      return createPrismaGeneralTransactionalAuditWriter(tx).append(input);
    } }), db,
  );
  const commands = new ProviderServiceService({ unitOfWork: uow, identityReader, staffAuthorizer });
  const queries = new ProviderServiceQueryService({ unitOfWork: uow, identityReader, staffAuthorizer });
  const snapshots = new ProviderServiceSnapshotService({ unitOfWork: uow });
  const meta = () => ({ actorUserId: owner.id, providerId: provider.id, requestId: randomUUID(), idempotencyKey: randomUUID() });
  const createCommand = () => ({ ...meta(), expectedVersion: 0 as const, catalogServiceCode: definition.serviceCode,
    catalogPriceUnitId, price: "120.00", minimumCharge: "150.00", estimatedDurationMinutes: 90,
    noteAr: "ملاحظة", noteEn: "Service note" });
  const create = () => commands.createOffering(createCommand());
  const snapshotInput = { providerId: provider.id, catalogServiceCode: definition.serviceCode, countryCode: "EG", locale: "EN" as const };
  const state = async () => ({
    offerings: await db.providerService.findMany({ where: { providerId: provider.id }, orderBy: { id: "asc" } }),
    prices: await db.providerServicePrice.findMany({ where: { providerId: provider.id }, orderBy: { id: "asc" } }),
    priceHistory: await db.providerServicePriceHistory.count({ where: { providerId: provider.id } }),
    statusHistory: await db.providerServiceStatusHistory.count({ where: { providerId: provider.id } }),
    audits: await db.auditLog.count({ where: { actorId: { in: [owner.id, staff.id] } } }),
  });
  const app = (actorUserId: string | null = owner.id) => createTestApp({
    environment: createTestEnvironment(), logger: new TestLogger(),
    mountTestRoutes(application) {
      const authenticateAccess: import("express").RequestHandler = (_request, response, next) => {
        if (actorUserId !== null) response.locals["authenticationPrincipal"] = { userId: actorUserId };
        next();
      };
      application.use("/api/v1/providers", createProviderServiceRouter({ authenticateAccess, service: {
        createOffering: commands.createOffering.bind(commands), replaceConfiguration: commands.replaceConfiguration.bind(commands),
        proposePrice: commands.proposePrice.bind(commands), applyLifecycle: commands.applyLifecycle.bind(commands),
        list: queries.list.bind(queries), get: queries.get.bind(queries),
        listPriceHistory: queries.listPriceHistory.bind(queries), listStatusHistory: queries.listStatusHistory.bind(queries),
      } }));
      application.use("/api/v1/staff/providers", createStaffProviderServiceRouter({ authenticateAccess, service: {
        decidePriceProposal: commands.decidePriceProposal.bind(commands),
        listStaffPendingPriceProposals: queries.listStaffPendingPriceProposals.bind(queries),
        getStaffPendingPriceDossier: queries.getStaffPendingPriceDossier.bind(queries),
      } }));
    },
  });
  return { db, owner, staff, provider, country, definition, catalogPriceUnitId, commands, queries, snapshots,
    uow, faults, meta, createCommand, create, snapshotInput, state, app, setPolicy,
    close: () => db.$disconnect() };
}

export type ProviderServicesLiveHarness = Awaited<ReturnType<typeof createProviderServicesLiveHarness>>;
