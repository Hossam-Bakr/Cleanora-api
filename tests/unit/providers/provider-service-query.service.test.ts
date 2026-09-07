
import type {
  ProviderServiceRepository,
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "../../../src/modules/providers/domain/provider-service.ports.js";
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import { ProviderServiceQueryService } from "../../../src/modules/providers/provider-service-query.service.js";
import { encodeR1P06Cursor } from "../../../src/modules/providers/domain/r1-p06.cursor.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
  createFakeCatalogDefinitionReader,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function offering(overrides: Partial<{ id: string; enabled: boolean }> = {}) {
  return {
    id: overrides.id ?? R1_P09_IDS.providerServiceId,
    providerId: R1_P09_IDS.providerId,
    catalogServiceId: R1_P09_IDS.catalogServiceId,
    enabled: overrides.enabled ?? false,
    estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
    noteAr: R1_P09_SENTINELS.noteAr,
    noteEn: R1_P09_SENTINELS.noteEn,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function price(status: "PENDING" | "EFFECTIVE" = "EFFECTIVE") {
  return {
    id: R1_P09_IDS.providerServicePriceId,
    providerId: R1_P09_IDS.providerId,
    providerServiceId: R1_P09_IDS.providerServiceId,
    catalogServiceId: R1_P09_IDS.catalogServiceId,
    catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
    priceUnitCodeAtProposal: R1_P09_IDS.catalogPriceUnitCode,
    countryIdAtProposal: R1_P09_IDS.countryId,
    countryCodeAtProposal: R1_P09_IDS.countryCode,
    currencyId: R1_P09_IDS.currencyId,
    currencyCode: R1_P09_IDS.currencyCode,
    currencyDecimalPlaces: 2,
    providerPriceMinorUnits: "12000",
    minimumChargeMinorUnits: "15000",
    maximumPriceMinorUnitsAtProposal: "999999",
    approvalRequiredAtProposal: status === "PENDING",
    status,
    proposedByUserId: R1_P09_IDS.ownerUserId,
    effectiveAt: status === "EFFECTIVE" ? NOW : null,
    rejectedAt: null,
    supersededAt: null,
    createdAt: NOW,
  };
}

function createIdentityReader(active = true) {
  return {
    getIdentity: async () => ({
      userId: R1_P09_IDS.ownerUserId,
      status: "ACTIVE",
      isAccountActive: active,
      isActiveNonVerificationOnly: active,
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
      emailNormalized: "owner@example.test",
      phoneE164: null,
      emailVerified: true,
      phoneVerified: false,
      providerAdminEnabled: true,
    }),
    findByEmailNormalized: async () => null,
  };
}

function createRepo(): ProviderServiceRepository {
  const row = offering();
  const effective = price("EFFECTIVE");
  const pending = price("PENDING");
  return {
    lockProviderScope: async () => ({
      id: R1_P09_IDS.providerId,
      applicationStatus: "APPROVED",
      operationalStatus: "ACTIVE",
      countryId: R1_P09_IDS.countryId,
      countryCode: R1_P09_IDS.countryCode,
    }),
    findActorMembership: async () => ({ level: "OWNER", active: true }),
    lockActorMembership: async () => ({ level: "OWNER", active: true }),
    findProviderDisplayIdentity: async () => ({
      displayNameAr: "مزود",
      displayNameEn: "Provider",
    }),
    findOffering: async () => row,
    lockOffering: async () => row,
    findOfferingByCatalogService: async () => null,
    listOfferings: async () => [row, offering({ id: "svc-2" })],
    createOffering: async () => row,
    updateConfiguration: async () => row,
    setEnabled: async () => row,
    bumpAggregateVersion: async () => row,
    findPrice: async () => pending,
    findCurrentEffectivePrice: async () => effective,
    findCurrentPendingPrice: async () => pending,
    createPrice: async () => pending,
    transitionPriceStatus: async () => pending,
    listPricesForOffering: async () => [],
    listPendingPricesForStaff: async () => [
      {
        price: pending,
        offeringVersion: 1,
        providerDisplayNameAr: "مزود",
        providerDisplayNameEn: "Provider",
      },
    ],
    findReceipt: async () => null,
    appendPriceHistory: async () => ({ id: "ph-1", createdAt: NOW } as never),
    appendStatusHistory: async () => ({ id: "sh-1", createdAt: NOW } as never),
    listPriceHistory: async () => [
      {
        id: "ph-1",
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        event: "PRICE_PROPOSED_PENDING",
        fromStatus: null,
        toStatus: "PENDING",
        actorUserId: R1_P09_IDS.ownerUserId,
        reasonCode: "PROVIDER_SERVICE_PRICE_PROPOSED",
        reasonText: R1_P09_SENTINELS.reasonText,
        safeBefore: null,
        safeAfter: { status: "PENDING" },
        requestId: R1_P09_IDS.requestId,
        aggregateVersion: 1,
        operationKey: "op",
        receipt: {
          scopeKey: "s",
          idempotencyKey: R1_P09_IDS.idempotencyKey,
          requestFingerprint: "fp",
          safeResultCode: null,
          safeResultJson: null,
        },
        createdAt: NOW,
      },
    ],
    listManagementStatusHistory: async () => [
      {
        id: "sh-1",
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        event: "OFFERING_ENABLED",
        fromEnabled: false,
        toEnabled: true,
        actorUserId: R1_P09_IDS.ownerUserId,
        reasonCode: "PROVIDER_SERVICE_ENABLED",
        reasonText: R1_P09_SENTINELS.reasonText,
        safeBefore: { enabled: false },
        safeAfter: { enabled: true },
        requestId: R1_P09_IDS.requestId,
        aggregateVersion: 2,
        operationKey: "op",
        receipt: {
          scopeKey: "s",
          idempotencyKey: R1_P09_IDS.idempotencyKey,
          requestFingerprint: "fp",
          safeResultCode: "OK",
          safeResultJson: {
            id: R1_P09_IDS.providerServiceId,
            providerId: R1_P09_IDS.providerId,
            version: 2,
          },
        },
        createdAt: NOW,
      },
    ],
    listReadinessProjections: async () => [
      {
        providerServiceId: R1_P09_IDS.providerServiceId,
        catalogServiceId: R1_P09_IDS.catalogServiceId,
        enabled: true,
        estimatedDurationMinutes: 90,
        noteAr: "a",
        noteEn: "b",
        version: 1,
        effectivePrice: effective,
        pendingPrice: null,
      },
    ],
    findEnabledOfferingWithEffectivePrice: async () => null,
  };
}

function createUow(
  overrides: Partial<ProviderServiceTransactionContext> = {},
): ProviderServiceUnitOfWork {
  const context: ProviderServiceTransactionContext = {
    identityReader: createIdentityReader() as never,

    providerServices: createRepo(),
    catalog: createFakeCatalogDefinitionReader(),
    pricingPolicy: {
      readForCountry: async () => ({
        status: "AVAILABLE" as const,
        value: {
          countryId: R1_P09_IDS.countryId,
          countryCode: R1_P09_IDS.countryCode,
          currency: {
            id: R1_P09_IDS.currencyId,
            code: R1_P09_IDS.currencyCode,
            decimalPlaces: 2,
          },
          approvalRequired: false,
          maximumPrice: R1_P09_SENTINELS.maximumPrice,
        },
      }),
    },
    staffAuthorizer: { authorize: async () => true },
    audit: { append: async () => ({ id: "a1", createdAt: NOW.toISOString() }) },
    ...overrides,
  };
  return {
    runMutation: async (work) => work(context),
    runReadSnapshot: async (work) => work(context),
  };
}

describe("provider-service-query.service", () => {
  it("lists, gets, and pages history for an exact Provider", async () => {
    const service = new ProviderServiceQueryService({
      unitOfWork: createUow(),
      identityReader: createIdentityReader() as never,
      staffAuthorizer: { authorize: async () => true },
    });

    const listed = await service.list({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      limit: 1,
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.nextCursor).toBeTypeOf("string");

    const detail = await service.get({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
    });
    expect(detail.id).toBe(R1_P09_IDS.providerServiceId);
    expect(detail.effectivePrice?.price).toBe("120.00");

    const prices = await service.listPriceHistory({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
    });
    expect(prices.items).toHaveLength(1);

    const statuses = await service.listStatusHistory({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
    });
    expect(statuses.items[0]?.event).toBe("OFFERING_ENABLED");
  });

  it("lists staff pending proposals and dossiers then derives servicesReady", async () => {
    const service = new ProviderServiceQueryService({
      unitOfWork: createUow(),
      identityReader: createIdentityReader() as never,
      staffAuthorizer: { authorize: async () => true },
    });

    const pending = await service.listStaffPendingPriceProposals({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      countryCode: "EG",
      limit: 25,
    });
    expect(pending.items).toHaveLength(1);

    const dossier = await service.getStaffPendingPriceDossier({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
    });
    expect(dossier.pendingPrice.status).toBe("PENDING");

    const ready = await service.getServicesReady(R1_P09_IDS.providerId);
    expect(ready).not.toBeNull();
    expect(ready?.servicesReady).toBeTypeOf("boolean");
    expect(ready?.providerId).toBe(R1_P09_IDS.providerId);
  });

  it("rejects invalid pagination and missing providers", async () => {
    const missingProviderRepo = createRepo();
    missingProviderRepo.lockProviderScope = async () => null;
    const service = new ProviderServiceQueryService({
      unitOfWork: createUow({ providerServices: missingProviderRepo }),
      identityReader: createIdentityReader() as never,
      staffAuthorizer: { authorize: async () => true },
    });

    await expect(
      service.list({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        limit: 999,
      }),
    ).rejects.toMatchObject({ code: "REQUEST_VALIDATION_FAILED" });

    await expect(
      service.list({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        cursor: "not-a-cursor",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_VALIDATION_FAILED" });

    await expect(
      service.get({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
      }),
    ).rejects.toBeInstanceOf(ProviderServiceError);

    expect(await service.getServicesReady(R1_P09_IDS.providerId)).toBeNull();
  });

  it("accepts a valid list cursor and denies staff without permission", async () => {
    const cursor = encodeR1P06Cursor(
      "provider-services-list",
      NOW,
      R1_P09_IDS.providerServiceId,
    );
    const service = new ProviderServiceQueryService({
      unitOfWork: createUow(),
      identityReader: createIdentityReader() as never,
      staffAuthorizer: { authorize: async () => false },
    });

    const listed = await service.list({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      cursor,
      limit: 25,
    });
    expect(listed.items.length).toBeGreaterThan(0);

    await expect(
      service.listStaffPendingPriceProposals({
        actorUserId: R1_P09_IDS.ownerUserId,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_FORBIDDEN" });
  });
});
