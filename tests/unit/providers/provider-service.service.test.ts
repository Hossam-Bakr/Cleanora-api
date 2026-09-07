
import type { ProviderIdentityReader } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProviderServiceRepository,
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "../../../src/modules/providers/domain/provider-service.ports.js";
import type { ProviderServicePriceSnapshot } from "../../../src/modules/providers/domain/provider-service.types.js";
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import { ProviderServiceService } from "../../../src/modules/providers/provider-service.service.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
  buildResolvedPricingPolicy,
  createFakeCatalogDefinitionReader,
  createFakePricingPolicyReader,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

function createIdentityReader(
  overrides: Partial<{
    active: boolean;
    providerAdminEnabled: boolean;
  }> = {},
): ProviderIdentityReader {
  return {
    getIdentity: async () => ({
      userId: R1_P09_IDS.ownerUserId,
      status: "ACTIVE",
      isAccountActive: overrides.active ?? true,
      isActiveNonVerificationOnly: overrides.active ?? true,
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
      emailNormalized: "owner@example.test",
      phoneE164: null,
      emailVerified: true,
      phoneVerified: false,
      providerAdminEnabled: overrides.providerAdminEnabled ?? true,
    }),
    findByEmailNormalized: async () => null,
  };
}

function createRepoFake(options?: {
  readonly receipt?: Awaited<
    ReturnType<ProviderServiceRepository["findReceipt"]>
  >;
  readonly approvalRequired?: boolean;
}): {
  readonly repo: ProviderServiceRepository;
  readonly calls: {
    catalogResolve: number;
    pricingRead: number;
    createOffering: number;
    createPrice: number;
    appendStatus: number;
    appendPrice: number;
    audit: number;
  };
} {
  const calls = {
    catalogResolve: 0,
    pricingRead: 0,
    createOffering: 0,
    createPrice: 0,
    appendStatus: 0,
    appendPrice: 0,
    audit: 0,
  };

  const now = new Date("2026-09-05T12:00:00.000Z");
  const offering = {
    id: R1_P09_IDS.providerServiceId,
    providerId: R1_P09_IDS.providerId,
    catalogServiceId: R1_P09_IDS.catalogServiceId,
    enabled: false,
    estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
    noteAr: R1_P09_SENTINELS.noteAr,
    noteEn: R1_P09_SENTINELS.noteEn,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const repo: ProviderServiceRepository = {
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
      displayNameAr: null,
      displayNameEn: null,
    }),
    findOffering: async () => offering,
    lockOffering: async () => offering,
    findOfferingByCatalogService: async () => null,
    listOfferings: async () => [offering],
    createOffering: async () => {
      calls.createOffering += 1;
      return offering;
    },
    updateConfiguration: async (input) => ({
      ...offering,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      noteAr: input.notes.noteAr,
      noteEn: input.notes.noteEn,
      version: input.expectedVersion + 1,
    }),
    setEnabled: async () => offering,
    bumpAggregateVersion: async () => offering,
    findPrice: async () => null,
    findCurrentEffectivePrice: async () => null,
    findCurrentPendingPrice: async () => null,
    createPrice: async (input) => {
      calls.createPrice += 1;
      return {
        id: input.id,
        providerId: input.providerId,
        providerServiceId: input.providerServiceId,
        catalogServiceId: input.catalogServiceId,
        catalogPriceUnitId: input.catalogPriceUnitId,
        priceUnitCodeAtProposal: input.priceUnitCodeAtProposal,
        countryIdAtProposal: input.countryIdAtProposal,
        countryCodeAtProposal: input.countryCodeAtProposal,
        currencyId: input.currencyId,
        currencyCode: input.currencyCode,
        currencyDecimalPlaces: input.currencyDecimalPlaces,
        providerPriceMinorUnits: input.providerPriceMinorUnits,
        minimumChargeMinorUnits: input.minimumChargeMinorUnits,
        maximumPriceMinorUnitsAtProposal: input.maximumPriceMinorUnitsAtProposal,
        approvalRequiredAtProposal: input.approvalRequiredAtProposal,
        status: input.status,
        proposedByUserId: input.proposedByUserId,
        effectiveAt: input.effectiveAt,
        rejectedAt: null,
        supersededAt: null,
        createdAt: input.createdAt,
      };
    },
    transitionPriceStatus: async () => {
      throw new Error("unused");
    },
    listPricesForOffering: async () => [],
    listPendingPricesForStaff: async () => [],
    findReceipt: async () => options?.receipt ?? null,
    appendPriceHistory: async (input) => {
      calls.appendPrice += 1;
      return { id: "price-history-1", createdAt: now, ...input };
    },
    appendStatusHistory: async (input) => {
      calls.appendStatus += 1;
      return { id: "status-history-1", createdAt: now, ...input };
    },
    listPriceHistory: async () => [],
    listManagementStatusHistory: async () => [],
    listReadinessProjections: async () => [],
    findEnabledOfferingWithEffectivePrice: async () => null,
  };

  void options?.approvalRequired;
  return { repo, calls };
}

function createUow(context: ProviderServiceTransactionContext): ProviderServiceUnitOfWork {
  return {
    runMutation: async (work) => work(context),
    runReadSnapshot: async (work) => work(context),
  };
}

describe("provider-service.service orchestration (T024)", () => {
  it("creates a disabled version-1 offering with effective price when approval is off", async () => {
    const { repo, calls } = createRepoFake();
    const catalog = createFakeCatalogDefinitionReader();
    const pricing = createFakePricingPolicyReader({
      status: "AVAILABLE",
      value: buildResolvedPricingPolicy({ approvalRequired: false }),
    });
    const catalogSpy = vi.spyOn(catalog, "resolveSelectableProviderOffering");
    const pricingSpy = vi.spyOn(pricing, "readForCountry");

    const audit = { append: vi.fn(async () => ({ id: "a1", createdAt: "2026-09-05T12:00:00.000Z" })) };
    const context: ProviderServiceTransactionContext = {
      identityReader: createIdentityReader() as never,

      providerServices: repo,
      catalog,
      pricingPolicy: pricing,
      staffAuthorizer: { authorize: async () => false },
      audit,
    };

    const service = new ProviderServiceService({
      unitOfWork: createUow(context),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
      createId: () => R1_P09_IDS.providerServiceId,
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await service.createOffering({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
      expectedVersion: 0,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: R1_P09_SENTINELS.providerPrice,
      minimumCharge: R1_P09_SENTINELS.minimumCharge,
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      noteAr: R1_P09_SENTINELS.noteAr,
      noteEn: R1_P09_SENTINELS.noteEn,
    });

    expect(result.replayed).toBe(false);
    expect(result.offering.enabled).toBe(false);
    expect(result.offering.version).toBe(1);
    expect(result.offering.effectivePrice?.status).toBe("EFFECTIVE");
    expect(result.offering.pendingPrice).toBeNull();
    expect(calls.createOffering).toBe(1);
    expect(calls.createPrice).toBe(1);
    expect(calls.appendStatus).toBe(1);
    expect(calls.appendPrice).toBe(1);
    expect(audit.append).toHaveBeenCalledOnce();
    expect(catalogSpy).toHaveBeenCalledOnce();
    expect(pricingSpy).toHaveBeenCalledOnce();
  });

  it("replays matching receipt before Catalog/config validation", async () => {
    const stored = {
      id: R1_P09_IDS.providerServiceId,
      providerId: R1_P09_IDS.providerId,
      catalogService: {
        id: R1_P09_IDS.catalogServiceId,
        code: R1_P09_IDS.catalogServiceCode,
        version: 1,
        selectableForProviderCountry: true,
      },
      enabled: false,
      estimatedDurationMinutes: 90,
      notes: { ar: null, en: null },
      version: 1,
      effectivePrice: null,
      pendingPrice: null,
      usability: { usable: false, blockerCodes: ["NO_EFFECTIVE_PRICE"] },
      createdAt: "2026-09-05T12:00:00.000Z",
      updatedAt: "2026-09-05T12:00:00.000Z",
    };

    // Fingerprint must match the canonical create body used below.
    const { fingerprintProviderServiceCommand, normalizeCatalogServiceCode, validateNotePair, validateDurationMinutes } =
      await import("../../../src/modules/providers/domain/provider-service.policy.js");
    const fingerprint = fingerprintProviderServiceCommand({
      operation: "CREATE_OFFERING",
      providerId: R1_P09_IDS.providerId,
      expectedVersion: 0,
      catalogServiceCode: normalizeCatalogServiceCode(R1_P09_IDS.catalogServiceCode),
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: R1_P09_SENTINELS.providerPrice,
      minimumCharge: R1_P09_SENTINELS.minimumCharge,
      estimatedDurationMinutes: validateDurationMinutes(
        R1_P09_SENTINELS.estimatedDurationMinutes,
      ),
      notes: validateNotePair({
        noteAr: R1_P09_SENTINELS.noteAr,
        noteEn: R1_P09_SENTINELS.noteEn,
      }),
    });

    const { repo, calls } = createRepoFake({
      receipt: {
        scopeKey: `provider:${R1_P09_IDS.providerId}:service:create:${R1_P09_IDS.catalogServiceCode}`,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        requestFingerprint: fingerprint,
        safeResultCode: "PROVIDER_SERVICE_CREATED",
        safeResultJson: stored,
        aggregateVersion: 1,
        source: "STATUS_HISTORY",
        historyId: "h1",
      },
    });

    const catalog = createFakeCatalogDefinitionReader();
    const pricing = createFakePricingPolicyReader();
    const catalogSpy = vi.spyOn(catalog, "resolveSelectableProviderOffering");
    const pricingSpy = vi.spyOn(pricing, "readForCountry");

    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog,
        pricingPolicy: pricing,
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
    });

    const result = await service.createOffering({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
      expectedVersion: 0,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: R1_P09_SENTINELS.providerPrice,
      minimumCharge: R1_P09_SENTINELS.minimumCharge,
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      noteAr: R1_P09_SENTINELS.noteAr,
      noteEn: R1_P09_SENTINELS.noteEn,
    });

    expect(result.replayed).toBe(true);
    expect(result.offering.id).toBe(R1_P09_IDS.providerServiceId);
    expect(calls.createOffering).toBe(0);
    expect(catalogSpy).not.toHaveBeenCalled();
    expect(pricingSpy).not.toHaveBeenCalled();
  });

  it("conflicts when the same key carries a different fingerprint", async () => {
    const { repo } = createRepoFake({
      receipt: {
        scopeKey: `provider:${R1_P09_IDS.providerId}:service:create:${R1_P09_IDS.catalogServiceCode}`,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        requestFingerprint: "0".repeat(64),
        safeResultCode: "PROVIDER_SERVICE_CREATED",
        safeResultJson: { id: "x" },
        aggregateVersion: 1,
        source: "STATUS_HISTORY",
        historyId: "h1",
      },
    });

    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
    });

    await expect(
      service.createOffering({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        expectedVersion: 0,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
        price: R1_P09_SENTINELS.providerPrice,
        minimumCharge: R1_P09_SENTINELS.minimumCharge,
        estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT" });
  });

  it("creates pending initial price when approval is required", async () => {
    const { repo } = createRepoFake();
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader({
          status: "AVAILABLE",
          value: buildResolvedPricingPolicy({ approvalRequired: true }),
        }),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
      createId: (() => {
        let n = 0;
        return () => (n++ === 0 ? R1_P09_IDS.providerServiceId : R1_P09_IDS.providerServicePriceId);
      })(),
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await service.createOffering({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
      expectedVersion: 0,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: R1_P09_SENTINELS.providerPrice,
      minimumCharge: R1_P09_SENTINELS.minimumCharge,
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
    });

    expect(result.offering.pendingPrice?.status).toBe("PENDING");
    expect(result.offering.effectivePrice).toBeNull();
  });

  it("denies create when provider_admin is disabled without mutating", async () => {
    const { repo, calls } = createRepoFake();
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader({ providerAdminEnabled: false }),
      staffAuthorizer: { authorize: async () => false },
    });

    await expect(
      service.createOffering({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        expectedVersion: 0,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
        price: R1_P09_SENTINELS.providerPrice,
        minimumCharge: R1_P09_SENTINELS.minimumCharge,
        estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      }),
    ).rejects.toBeInstanceOf(ProviderServiceError);
    expect(calls.createOffering).toBe(0);
  });
});

describe("provider-service.service price/lifecycle (T040)", () => {
  function createPriceAwareRepo(options?: {
    readonly approvalRequired?: boolean;
    readonly enabled?: boolean;
    readonly effectivePrice?: boolean;
    readonly pendingPrice?: boolean;
  }) {
    const now = new Date("2026-09-05T12:00:00.000Z");
    let version = 1;
    let enabled = options?.enabled ?? false;
    let effective: ProviderServicePriceSnapshot | null = null;
    let pending: ProviderServicePriceSnapshot | null = null;

    const basePrice = {
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
      proposedByUserId: R1_P09_IDS.ownerUserId,
      rejectedAt: null,
      supersededAt: null,
      createdAt: now,
    };

    if (options?.effectivePrice !== false) {
      effective = {
        ...basePrice,
        id: "price-effective-1",
        approvalRequiredAtProposal: false,
        status: "EFFECTIVE",
        effectiveAt: now,
      };
    }
    if (options?.pendingPrice === true) {
      pending = {
        ...basePrice,
        id: "price-pending-1",
        approvalRequiredAtProposal: true,
        status: "PENDING",
        effectiveAt: null,
      };
    }

    const calls = {
      bump: 0,
      createPrice: 0,
      transition: 0,
      appendPrice: 0,
      appendStatus: 0,
      setEnabled: 0,
      audit: 0,
    };

    const offering = () => ({
      id: R1_P09_IDS.providerServiceId,
      providerId: R1_P09_IDS.providerId,
      catalogServiceId: R1_P09_IDS.catalogServiceId,
      enabled,
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      noteAr: R1_P09_SENTINELS.noteAr,
      noteEn: R1_P09_SENTINELS.noteEn,
      version,
      createdAt: now,
      updatedAt: now,
    });

    const repo: ProviderServiceRepository = {
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
        displayNameAr: null,
        displayNameEn: null,
      }),
      findOffering: async () => offering(),
      lockOffering: async () => offering(),
      findOfferingByCatalogService: async () => null,
      listOfferings: async () => [offering()],
      createOffering: async () => offering(),
      updateConfiguration: async (input) => {
        version = input.expectedVersion + 1;
        return {
          ...offering(),
          estimatedDurationMinutes: input.estimatedDurationMinutes,
          noteAr: input.notes.noteAr,
          noteEn: input.notes.noteEn,
          version,
        };
      },
      setEnabled: async (input) => {
        calls.setEnabled += 1;
        enabled = input.enabled;
        version = input.expectedVersion + 1;
        return offering();
      },
      bumpAggregateVersion: async (input) => {
        calls.bump += 1;
        if (input.expectedVersion !== version) return null;
        version += 1;
        return offering();
      },
      findPrice: async () => null,
      findCurrentEffectivePrice: async () => effective,
      findCurrentPendingPrice: async () => pending,
      createPrice: async (input) => {
        calls.createPrice += 1;
        const created: ProviderServicePriceSnapshot = {
          id: input.id,
          providerId: input.providerId,
          providerServiceId: input.providerServiceId,
          catalogServiceId: input.catalogServiceId,
          catalogPriceUnitId: input.catalogPriceUnitId,
          priceUnitCodeAtProposal: input.priceUnitCodeAtProposal,
          countryIdAtProposal: input.countryIdAtProposal,
          countryCodeAtProposal: input.countryCodeAtProposal,
          currencyId: input.currencyId,
          currencyCode: input.currencyCode,
          currencyDecimalPlaces: input.currencyDecimalPlaces,
          providerPriceMinorUnits: input.providerPriceMinorUnits,
          minimumChargeMinorUnits: input.minimumChargeMinorUnits,
          maximumPriceMinorUnitsAtProposal: input.maximumPriceMinorUnitsAtProposal,
          approvalRequiredAtProposal: input.approvalRequiredAtProposal,
          status: input.status,
          proposedByUserId: input.proposedByUserId,
          effectiveAt: input.effectiveAt,
          rejectedAt: null,
          supersededAt: null,
          createdAt: input.createdAt,
        };
        if (input.status === "EFFECTIVE") effective = created;
        if (input.status === "PENDING") pending = created;
        return created;
      },
      transitionPriceStatus: async (input) => {
        calls.transition += 1;
        const target =
          effective?.id === input.providerServicePriceId
            ? effective
            : pending?.id === input.providerServicePriceId
              ? pending
              : null;
        if (target === null) {
          throw new Error("missing price");
        }
        const next: ProviderServicePriceSnapshot = {
          ...target,
          status: input.toStatus,
          supersededAt:
            input.toStatus === "SUPERSEDED" ? input.transitionedAt : null,
          effectiveAt:
            input.toStatus === "EFFECTIVE"
              ? input.transitionedAt
              : target.effectiveAt,
        };
        if (effective?.id === input.providerServicePriceId) {
          effective = input.toStatus === "SUPERSEDED" ? null : next;
        }
        if (pending?.id === input.providerServicePriceId) {
          pending = input.toStatus === "SUPERSEDED" ? null : next;
        }
        return next;
      },
      listPricesForOffering: async () => [],
      listPendingPricesForStaff: async () => [],
      findReceipt: async () => null,
      appendPriceHistory: async (input) => {
        calls.appendPrice += 1;
        return { id: `ph-${calls.appendPrice}`, createdAt: now, ...input };
      },
      appendStatusHistory: async (input) => {
        calls.appendStatus += 1;
        return { id: `sh-${calls.appendStatus}`, createdAt: now, ...input };
      },
      listPriceHistory: async () => [],
      listManagementStatusHistory: async () => [],
      listReadinessProjections: async () => [],
      findEnabledOfferingWithEffectivePrice: async () => null,
    };

    void options?.approvalRequired;
    return { repo, calls, getVersion: () => version };
  }

  it("proposes an immediate effective price and supersedes prior effective once", async () => {
    const { repo, calls } = createPriceAwareRepo({ effectivePrice: true });
    const audit = {
      append: vi.fn(async () => ({ id: "a1", createdAt: "2026-09-05T12:00:00.000Z" })),
    };
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader({
          status: "AVAILABLE",
          value: buildResolvedPricingPolicy({ approvalRequired: false }),
        }),
        staffAuthorizer: { authorize: async () => false },
        audit,
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
      createId: () => "price-new-1",
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await service.proposePrice({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000011",
      expectedVersion: 1,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: "200.00",
      minimumCharge: "220.00",
      reason: R1_P09_SENTINELS.reasonText,
    });

    expect(result.replayed).toBe(false);
    expect(result.offering.version).toBe(2);
    expect(result.offering.effectivePrice?.id).toBe("price-new-1");
    expect(calls.bump).toBe(1);
    expect(calls.transition).toBe(1);
    expect(calls.createPrice).toBe(1);
    expect(calls.appendPrice).toBe(2);
    expect(audit.append).toHaveBeenCalledOnce();
  });

  it("proposes pending without superseding prior effective when approval is required", async () => {
    const { repo, calls } = createPriceAwareRepo({
      effectivePrice: true,
      pendingPrice: true,
    });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader({
          status: "AVAILABLE",
          value: buildResolvedPricingPolicy({ approvalRequired: true }),
        }),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
      createId: () => "price-pending-2",
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await service.proposePrice({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000012",
      expectedVersion: 1,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: "210.00",
      minimumCharge: "230.00",
      reason: R1_P09_SENTINELS.reasonText,
    });

    expect(result.offering.pendingPrice?.id).toBe("price-pending-2");
    expect(result.offering.effectivePrice?.id).toBe("price-effective-1");
    expect(calls.transition).toBe(1);
    expect(calls.bump).toBe(1);
  });

  it("enables when usable and appends OFFERING_ENABLED history", async () => {
    const { repo, calls } = createPriceAwareRepo({
      enabled: false,
      effectivePrice: true,
    });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
    });

    const result = await service.applyLifecycle({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000013",
      expectedVersion: 1,
      action: "ENABLE",
      reason: R1_P09_SENTINELS.reasonText,
    });

    expect(result.offering.enabled).toBe(true);
    expect(result.offering.version).toBe(2);
    expect(calls.setEnabled).toBe(1);
    expect(calls.appendStatus).toBe(1);
  });

  it("returns enable blocked when no effective price exists", async () => {
    const { repo, calls } = createPriceAwareRepo({
      enabled: false,
      effectivePrice: false,
      pendingPrice: true,
    });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
    });

    await expect(
      service.applyLifecycle({
        actorUserId: R1_P09_IDS.ownerUserId,
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: "00000000-0000-4000-8000-000000000014",
        expectedVersion: 1,
        action: "ENABLE",
        reason: R1_P09_SENTINELS.reasonText,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_ENABLE_BLOCKED" });
    expect(calls.setEnabled).toBe(0);
  });

  it("no-ops lifecycle when already in the requested state without history", async () => {
    const { repo, calls } = createPriceAwareRepo({
      enabled: false,
      effectivePrice: true,
    });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
    });

    const result = await service.applyLifecycle({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000015",
      expectedVersion: 1,
      action: "DISABLE",
      reason: R1_P09_SENTINELS.reasonText,
    });

    expect(result.offering.enabled).toBe(false);
    expect(result.offering.version).toBe(1);
    expect(calls.setEnabled).toBe(0);
    expect(calls.appendStatus).toBe(0);
  });

  it("replaces configuration without mutating prices", async () => {
    const { repo, calls } = createPriceAwareRepo({ effectivePrice: true });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
    });

    const result = await service.replaceConfiguration({
      actorUserId: R1_P09_IDS.ownerUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000016",
      expectedVersion: 1,
      estimatedDurationMinutes: 45,
      noteAr: "مدة جديدة",
      noteEn: "New duration",
    });

    expect(result.replayed).toBe(false);
    expect(result.offering.estimatedDurationMinutes).toBe(45);
    expect(calls.createPrice).toBe(0);
  });

  it("approves a pending price and supersedes prior effective", async () => {
    const { repo, calls } = createPriceAwareRepo({
      effectivePrice: true,
      pendingPrice: true,
      approvalRequired: true,
    });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: {
          ...repo,
          findPrice: async () => ({
            id: "price-pending-1",
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
            approvalRequiredAtProposal: true,
            status: "PENDING",
            proposedByUserId: R1_P09_IDS.ownerUserId,
            effectiveAt: null,
            rejectedAt: null,
            supersededAt: null,
            createdAt: new Date("2026-09-05T12:00:00.000Z"),
          }),
        },
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader({
          status: "AVAILABLE",
          value: buildResolvedPricingPolicy({ approvalRequired: true }),
        }),
        staffAuthorizer: { authorize: async () => true },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => true },
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await service.decidePriceProposal({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: "price-pending-1",
      decision: "APPROVE",
      reason: R1_P09_SENTINELS.reasonText,
      expectedVersion: 1,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000017",
    });

    expect(result.replayed).toBe(false);
    expect(result.result.decision).toBe("APPROVE");
    expect(result.result.priceStatus).toBe("EFFECTIVE");
    expect(calls.transition).toBeGreaterThanOrEqual(1);
    expect(calls.bump).toBe(1);
  });

  it("rejects a pending price without touching the prior effective", async () => {
    const { repo, calls } = createPriceAwareRepo({
      effectivePrice: true,
      pendingPrice: true,
    });
    const service = new ProviderServiceService({
      unitOfWork: createUow({
        identityReader: createIdentityReader() as never,

        providerServices: {
          ...repo,
          findPrice: async () => ({
            id: "price-pending-1",
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
            approvalRequiredAtProposal: true,
            status: "PENDING",
            proposedByUserId: R1_P09_IDS.ownerUserId,
            effectiveAt: null,
            rejectedAt: null,
            supersededAt: null,
            createdAt: new Date("2026-09-05T12:00:00.000Z"),
          }),
        },
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader({
          status: "AVAILABLE",
          value: buildResolvedPricingPolicy({ approvalRequired: true }),
        }),
        staffAuthorizer: { authorize: async () => true },
        audit: { append: async () => ({ id: "a1", createdAt: "x" }) },
      }),
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => true },
      now: () => new Date("2026-09-05T12:00:00.000Z"),
    });

    const result = await service.decidePriceProposal({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: "price-pending-1",
      decision: "REJECT",
      reason: R1_P09_SENTINELS.reasonText,
      expectedVersion: 1,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: "00000000-0000-4000-8000-000000000018",
    });

    expect(result.result.decision).toBe("REJECT");
    expect(result.result.priceStatus).toBe("REJECTED");
    expect(result.result.effectivePriceId).toBe("price-effective-1");
    expect(calls.bump).toBe(1);
  });
});

describe("Provider identity revocation before transaction", () => {
  it("rejects a revoked Provider role even when preflight identity was active", async () => {
    const { repo, calls } = createRepoFake();
    const service = new ProviderServiceService({
      identityReader: createIdentityReader(),
      staffAuthorizer: { authorize: async () => false },
      unitOfWork: createUow({
        identityReader: createIdentityReader({ providerAdminEnabled: false }),
        providerServices: repo,
        catalog: createFakeCatalogDefinitionReader(),
        pricingPolicy: createFakePricingPolicyReader(),
        staffAuthorizer: { authorize: async () => false },
        audit: { append: vi.fn() },
      }),
    });
    await expect(service.createOffering({
      actorUserId: R1_P09_IDS.ownerUserId, providerId: R1_P09_IDS.providerId,
      requestId: "revocation", idempotencyKey: R1_P09_IDS.idempotencyKey,
      expectedVersion: 0, catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: "120.00", minimumCharge: "150.00", estimatedDurationMinutes: 90,
    })).rejects.toMatchObject({ code: "PROVIDER_SERVICE_FORBIDDEN" });
    expect(calls.createOffering).toBe(0);
    expect(calls.createPrice).toBe(0);
  });
});
