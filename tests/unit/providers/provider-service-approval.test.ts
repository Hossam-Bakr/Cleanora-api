/**
 * Staff price approval unit coverage (T046).
 */


import type { ProviderIdentityReader } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProviderServiceRepository,
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "../../../src/modules/providers/domain/provider-service.ports.js";
import type { ProviderServicePriceSnapshot } from "../../../src/modules/providers/domain/provider-service.types.js";
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  buildStaffPriceDecisionScopeKey,
  fingerprintProviderServiceCommand,
  resolvePriceTransition,
  validateStaffDecisionReason,
} from "../../../src/modules/providers/domain/provider-service.policy.js";
import {
  assertSafeProviderServiceOutput,
  toStaffPriceDecisionResultDto,
} from "../../../src/modules/providers/provider-service.dto.js";
import { ProviderServiceService } from "../../../src/modules/providers/provider-service.service.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
  buildResolvedPricingPolicy,
  createFakeCatalogDefinitionReader,
  createFakePricingPolicyReader,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

function createIdentityReader(): ProviderIdentityReader {
  return {
    getIdentity: async () => ({
      userId: R1_P09_IDS.staffAdminUserId,
      status: "ACTIVE",
      isAccountActive: true,
      isActiveNonVerificationOnly: true,
      accountCategories: ["PROVIDER_OWNER"],
      verifiedCategories: ["PROVIDER_OWNER"],
      emailNormalized: "staff@example.test",
      phoneE164: null,
      emailVerified: true,
      phoneVerified: false,
      providerAdminEnabled: false,
    }),
    findByEmailNormalized: async () => null,
  };
}

describe("provider-service Staff approval policy (T046)", () => {
  it("requires a trimmed Staff reason of 1–1000 characters", () => {
    expect(validateStaffDecisionReason("  accepted  ")).toBe("accepted");
    expect(() => validateStaffDecisionReason("   ")).toThrow(ProviderServiceError);
    expect(() => validateStaffDecisionReason("x".repeat(1001))).toThrow(
      ProviderServiceError,
    );
  });

  it("approves PENDING to EFFECTIVE and rejects PENDING to REJECTED only", () => {
    expect(
      resolvePriceTransition({
        fromStatus: "PENDING",
        trigger: "STAFF_APPROVE",
      }),
    ).toEqual({ toStatus: "EFFECTIVE", event: "PRICE_APPROVED" });
    expect(
      resolvePriceTransition({
        fromStatus: "PENDING",
        trigger: "STAFF_REJECT",
      }),
    ).toEqual({ toStatus: "REJECTED", event: "PRICE_REJECTED" });
    expect(() =>
      resolvePriceTransition({
        fromStatus: "EFFECTIVE",
        trigger: "STAFF_APPROVE",
      }),
    ).toThrow(ProviderServiceError);
  });

  it("maps Staff decision DTOs without contacts, receipts, or audit internals", () => {
    const dto = toStaffPriceDecisionResultDto({
      decision: "APPROVE",
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      priceStatus: "EFFECTIVE",
      version: 2,
      effectivePriceId: R1_P09_IDS.providerServicePriceId,
    });
    expect(dto.decision).toBe("APPROVE");
    expect(dto).not.toHaveProperty("receipt");
    expect(dto).not.toHaveProperty("safeResultJson");
    expect(dto).not.toHaveProperty("contact");
    assertSafeProviderServiceOutput(dto);
  });
});

describe("provider-service Staff approval orchestration (T046)", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  function pendingPrice(overrides: Partial<{
    status: "PENDING" | "EFFECTIVE" | "REJECTED" | "SUPERSEDED";
    id: string;
  }> = {}): ProviderServicePriceSnapshot {
    return {
      id: overrides.id ?? R1_P09_IDS.providerServicePriceId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      catalogServiceId: R1_P09_IDS.catalogServiceId,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      priceUnitCodeAtProposal: R1_P09_IDS.catalogPriceUnitCode,
      countryIdAtProposal: R1_P09_IDS.countryId,
      countryCodeAtProposal: R1_P09_IDS.countryCode,
      currencyId: R1_P09_IDS.currencyId,
      currencyCode: R1_P09_IDS.currencyCode,
      currencyDecimalPlaces: R1_P09_SENTINELS.currencyDecimalPlaces,
      providerPriceMinorUnits: "12000",
      minimumChargeMinorUnits: "15000",
      maximumPriceMinorUnitsAtProposal: "999999",
      approvalRequiredAtProposal: true,
      status: overrides.status ?? ("PENDING" as const),
      proposedByUserId: R1_P09_IDS.ownerUserId,
      effectiveAt: null,
      rejectedAt: null,
      supersededAt: null,
      createdAt: now,
    };
  }

  function createHarness(options?: {
    readonly approvalRequired?: boolean;
    readonly staffPermitted?: boolean;
    readonly receipt?: Awaited<
      ReturnType<ProviderServiceRepository["findReceipt"]>
    >;
    readonly priorEffective?: ReturnType<typeof pendingPrice> | null;
    readonly pending?: ReturnType<typeof pendingPrice>;
  }) {
    const calls = {
      transition: [] as Array<{ from: string; to: string; id: string }>,
      audit: 0,
      appendPrice: 0,
      bump: 0,
      pricingRead: 0,
    };

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

    let currentPending: ProviderServicePriceSnapshot =
      options?.pending ?? pendingPrice();
    let currentEffective: ProviderServicePriceSnapshot | null =
      options?.priorEffective === undefined ? null : options.priorEffective;

    const repo: ProviderServiceRepository = {
      lockProviderScope: async () => ({
        id: R1_P09_IDS.providerId,
        applicationStatus: "APPROVED",
        operationalStatus: "ACTIVE",
        countryId: R1_P09_IDS.countryId,
        countryCode: R1_P09_IDS.countryCode,
      }),
      findProviderDisplayIdentity: async () => ({
        displayNameAr: "مزود",
        displayNameEn: "Provider",
      }),
      findActorMembership: async () => ({ level: "OWNER", active: true }),
      lockActorMembership: async () => ({ level: "OWNER", active: true }),
      findOffering: async () => offering,
      lockOffering: async () => offering,
      findOfferingByCatalogService: async () => null,
      listOfferings: async () => [offering],
      createOffering: async () => offering,
      updateConfiguration: async () => offering,
      setEnabled: async () => offering,
      bumpAggregateVersion: async () => {
        calls.bump += 1;
        return { ...offering, version: offering.version + 1 };
      },
      findPrice: async () => currentPending,
      findCurrentEffectivePrice: async () => currentEffective,
      findCurrentPendingPrice: async () =>
        currentPending.status === "PENDING" ? currentPending : null,
      createPrice: async () => currentPending,
      transitionPriceStatus: async (input) => {
        calls.transition.push({
          from: input.fromStatus,
          to: input.toStatus,
          id: input.providerServicePriceId,
        });
        if (input.toStatus === "SUPERSEDED" && currentEffective !== null) {
          currentEffective = {
            ...currentEffective,
            status: "SUPERSEDED",
            supersededAt: now,
          };
          return currentEffective;
        }
        currentPending = {
          ...currentPending,
          status: input.toStatus,
          effectiveAt: input.toStatus === "EFFECTIVE" ? now : null,
          rejectedAt: input.toStatus === "REJECTED" ? now : null,
        };
        if (input.toStatus === "EFFECTIVE") {
          currentEffective = currentPending;
        }
        return currentPending;
      },
      listPricesForOffering: async () => [],
      listPendingPricesForStaff: async () => [],
      findReceipt: async () => options?.receipt ?? null,
      appendPriceHistory: async (input) => {
        calls.appendPrice += 1;
        return { id: `ph-${calls.appendPrice}`, createdAt: now, ...input };
      },
      appendStatusHistory: async (input) => ({
        id: "sh-1",
        createdAt: now,
        ...input,
      }),
      listPriceHistory: async () => [],
      listManagementStatusHistory: async () => [],
      listReadinessProjections: async () => [],
      findEnabledOfferingWithEffectivePrice: async () => null,
    };

    const staffAuthorizer = {
      authorize: vi.fn(async () => options?.staffPermitted ?? true),
    };

    const basePricing = createFakePricingPolicyReader({
      status: "AVAILABLE",
      value: buildResolvedPricingPolicy({
        approvalRequired: options?.approvalRequired ?? true,
      }),
    });

    const unitOfWork: ProviderServiceUnitOfWork = {
      runMutation: async (work) => {
        const context: ProviderServiceTransactionContext = {
          identityReader: createIdentityReader() as never,

          providerServices: repo,
          catalog: createFakeCatalogDefinitionReader(),
          pricingPolicy: {
            readForCountry: async (input) => {
              calls.pricingRead += 1;
              return basePricing.readForCountry(input);
            },
          },
          staffAuthorizer,
          audit: {
            append: async () => {
              calls.audit += 1;
              return { id: `audit-${calls.audit}`, createdAt: now.toISOString() };
            },
          },
        };
        return work(context);
      },
      runReadSnapshot: async (work) =>
        unitOfWork.runMutation(work as never),
    };

    const service = new ProviderServiceService({
      unitOfWork,
      identityReader: createIdentityReader(),
      staffAuthorizer,
      now: () => now,
    });

    return { service, calls, staffAuthorizer };
  }

  it("approves PENDING→EFFECTIVE, supersedes prior EFFECTIVE, bumps once, audits", async () => {
    const prior = pendingPrice({
      id: "prior-effective",
      status: "EFFECTIVE",
    });
    const { service, calls } = createHarness({
      priorEffective: prior,
      approvalRequired: true,
    });

    const result = await service.decidePriceProposal({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      decision: "APPROVE",
      reason: "Evidence accepted",
      expectedVersion: 1,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
    });

    expect(result.replayed).toBe(false);
    expect(result.result.priceStatus).toBe("EFFECTIVE");
    expect(result.result.version).toBe(2);
    expect(result.result.effectivePriceId).toBe(
      R1_P09_IDS.providerServicePriceId,
    );
    expect(calls.bump).toBe(1);
    expect(calls.audit).toBe(1);
    expect(calls.transition).toEqual([
      { from: "EFFECTIVE", to: "SUPERSEDED", id: "prior-effective" },
      {
        from: "PENDING",
        to: "EFFECTIVE",
        id: R1_P09_IDS.providerServicePriceId,
      },
    ]);
  });

  it("rejects PENDING→REJECTED and leaves EFFECTIVE unchanged", async () => {
    const prior = pendingPrice({
      id: "prior-effective",
      status: "EFFECTIVE",
    });
    const { service, calls } = createHarness({
      priorEffective: prior,
      approvalRequired: true,
    });

    const result = await service.decidePriceProposal({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      decision: "REJECT",
      reason: "Incomplete evidence",
      expectedVersion: 1,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
    });

    expect(result.result.priceStatus).toBe("REJECTED");
    expect(result.result.effectivePriceId).toBe("prior-effective");
    expect(calls.transition).toEqual([
      {
        from: "PENDING",
        to: "REJECTED",
        id: R1_P09_IDS.providerServicePriceId,
      },
    ]);
  });

  it("fails fresh decisions when current policy does not require approval", async () => {
    const { service, calls } = createHarness({ approvalRequired: false });
    await expect(
      service.decidePriceProposal({
        actorUserId: R1_P09_IDS.staffAdminUserId,
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        decision: "APPROVE",
        reason: "Should not apply",
        expectedVersion: 1,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_SERVICE_PRICE_APPROVAL_NOT_REQUIRED",
    });
    expect(calls.bump).toBe(0);
    expect(calls.audit).toBe(0);
    expect(calls.transition).toHaveLength(0);
  });

  it("replays identical completed Staff decision after authz before fresh policy checks", async () => {
    const stored = toStaffPriceDecisionResultDto({
      decision: "APPROVE",
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      priceStatus: "EFFECTIVE",
      version: 2,
      effectivePriceId: R1_P09_IDS.providerServicePriceId,
    });
    const reason = validateStaffDecisionReason("Evidence accepted");
    const requestFingerprint = fingerprintProviderServiceCommand({
      operation: "STAFF_PRICE_DECISION",
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      decision: "APPROVE",
      expectedVersion: 1,
      reason,
    });
    const scopeKey = buildStaffPriceDecisionScopeKey(
      R1_P09_IDS.providerId,
      R1_P09_IDS.providerServiceId,
      R1_P09_IDS.providerServicePriceId,
    );

    const { service, calls, staffAuthorizer } = createHarness({
      approvalRequired: false,
      receipt: {
        scopeKey,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        requestFingerprint,
        safeResultCode: "PROVIDER_SERVICE_PRICE_APPROVED",
        safeResultJson: structuredClone(stored) as never,
        aggregateVersion: 2,
        source: "PRICE_HISTORY",
        historyId: "hist-1",
      },
    });

    const replayed = await service.decidePriceProposal({
      actorUserId: R1_P09_IDS.staffAdminUserId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      decision: "APPROVE",
      reason: "Evidence accepted",
      expectedVersion: 1,
      requestId: R1_P09_IDS.requestId,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
    });

    expect(replayed.replayed).toBe(true);
    expect(replayed.result).toEqual(stored);
    expect(calls.pricingRead).toBe(0);
    expect(calls.bump).toBe(0);
    expect(calls.audit).toBe(0);
    expect(staffAuthorizer.authorize).toHaveBeenCalled();
  });

  it("denies Staff decisions without providers.services.prices.approve", async () => {
    const { service, calls } = createHarness({ staffPermitted: false });
    await expect(
      service.decidePriceProposal({
        actorUserId: R1_P09_IDS.staffAdminUserId,
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        providerServicePriceId: R1_P09_IDS.providerServicePriceId,
        decision: "APPROVE",
        reason: "Evidence accepted",
        expectedVersion: 1,
        requestId: R1_P09_IDS.requestId,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_SERVICE_FORBIDDEN" });
    expect(calls.bump).toBe(0);
  });
});
