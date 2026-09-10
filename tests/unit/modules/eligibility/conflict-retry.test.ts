/**
 * Conflict retry orchestration + technical-error normalization (Codex FAIL repair).
 */

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  createEligibilityApplicationService,
  type EligibilityApplicationServiceDependencies,
} from "#modules/eligibility/eligibility.service";
import {
  isRetryableConflictError,
  normalizeEligibilityPersistenceError,
  normalizeEligibilityTechnicalError,
} from "#modules/eligibility/eligibility.technical-errors";
import type { EligibilityUnitOfWork } from "#modules/eligibility/infrastructure/eligibility.unit-of-work";
import type { PrismaEligibilityRepository } from "#modules/eligibility/infrastructure/prisma-eligibility.repository";
import {
  buildDiscoveryRequest,
  R1_P11_IDS,
  R1_P11_TIMES,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";
import {
  computeR1P11EligibilityRuleContentChecksum,
  R1_P11_ELIGIBILITY_RULE_SEED,
} from "../../../../prisma/seed.js";

const RULE_CHECKSUM = computeR1P11EligibilityRuleContentChecksum({
  schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
  engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
  ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
  parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
});

function emptyDiscoveryFactories(): Pick<
  EligibilityApplicationServiceDependencies,
  | "createActiveCountryReader"
  | "createLocalityReader"
  | "createCountryTimeZoneReader"
  | "createCatalogReader"
  | "createPricingReader"
  | "createLifecycleReader"
  | "createAvailabilityReader"
> {
  return {
    createActiveCountryReader: () =>
      ({
        getActiveCountryById: vi.fn().mockResolvedValue({
          id: R1_P11_IDS.countryId,
          code: "EG",
        }),
      }) as never,
    createLocalityReader: () =>
      ({
        findCityById: vi.fn().mockResolvedValue({
          id: R1_P11_IDS.cityId,
          countryId: R1_P11_IDS.countryId,
          isActive: true,
          countryActive: true,
        }),
        findDistrictById: vi.fn().mockResolvedValue({
          id: R1_P11_IDS.districtId,
          cityId: R1_P11_IDS.cityId,
          countryId: R1_P11_IDS.countryId,
          isActive: true,
          cityActive: true,
          countryActive: true,
        }),
      }) as never,
    createCountryTimeZoneReader: () =>
      ({
        getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
      }) as never,
    createCatalogReader: () =>
      ({
        getProviderOfferingReference: vi.fn().mockResolvedValue({
          serviceId: R1_P11_IDS.serviceId,
          serviceCode: "STANDARD_HOME_CLEANING",
          selectableForCountry: true,
          activePriceUnits: [],
        }),
      }) as never,
    createPricingReader: () =>
      ({
        getEligibilityPricingFacts: vi.fn(),
      }) as never,
    createLifecycleReader: () =>
      ({
        getLifecycleFacts: vi.fn(),
      }) as never,
    createAvailabilityReader: () =>
      ({
        discoverProviderIds: vi.fn().mockResolvedValue({
          status: "OK",
          providerIds: [],
        }),
        getAvailabilityFacts: vi.fn(),
      }) as never,
  };
}

describe("eligibility technical error normalization", () => {
  it("classifies structural CONFLICT and Prisma/SQLSTATE codes as retryable", () => {
    expect(
      isRetryableConflictError(Object.assign(new Error("pricing"), { code: "CONFLICT" })),
    ).toBe(true);
    expect(isRetryableConflictError(Object.assign(new Error("x"), { code: "P2034" }))).toBe(
      true,
    );
    expect(isRetryableConflictError(Object.assign(new Error("x"), { code: "P2028" }))).toBe(
      true,
    );
    expect(
      isRetryableConflictError(
        Object.assign(new Error("x"), {
          cause: { originalCode: "40001" },
        }),
      ),
    ).toBe(true);
    expect(
      isRetryableConflictError(
        Object.assign(new Error("x"), {
          cause: { originalCode: "40P01" },
        }),
      ),
    ).toBe(true);
    expect(isRetryableConflictError(new Error("other"))).toBe(false);
  });

  it("maps retryable insert conflicts to CONFLICT not PERSISTENCE_FAILED", () => {
    const mapped = normalizeEligibilityPersistenceError(
      Object.assign(new Error("serialize"), { code: "P2034" }),
    );
    expect(mapped).toBeInstanceOf(EligibilityError);
    expect(mapped.code).toBe("CONFLICT");
  });

  it("maps non-retryable persistence failures to PERSISTENCE_FAILED", () => {
    expect(normalizeEligibilityPersistenceError(new Error("disk")).code).toBe(
      "PERSISTENCE_FAILED",
    );
  });

  it("maps INVALID_DEPENDENCY_DTO structural codes", () => {
    expect(
      normalizeEligibilityTechnicalError(
        Object.assign(new Error("bad dto"), { code: "INVALID_DEPENDENCY_DTO" }),
      ).code,
    ).toBe("INVALID_DEPENDENCY_DTO");
  });

  it("classifies SQLSTATE codes nested in Prisma driver adapter meta", () => {
    expect(
      isRetryableConflictError({
        meta: {
          driverAdapterError: { cause: { originalCode: "40001" } },
        },
      }),
    ).toBe(true);
    expect(
      isRetryableConflictError({
        meta: { code: "40P01" },
      }),
    ).toBe(true);
    expect(isRetryableConflictError({ meta: { driverAdapterError: 1 } })).toBe(
      false,
    );
    expect(
      isRetryableConflictError({
        cause: { code: "40001" },
      }),
    ).toBe(true);
  });

  it("maps Prisma-named and message-based dependency outages", () => {
    expect(
      normalizeEligibilityTechnicalError(
        Object.assign(new Error("query"), {
          name: "PrismaClientKnownRequestError",
        }),
      ).code,
    ).toBe("DEPENDENCY_FAILURE");
    expect(
      normalizeEligibilityTechnicalError(new Error("reader timeout ECONNREFUSED"))
        .code,
    ).toBe("DEPENDENCY_FAILURE");
    expect(normalizeEligibilityTechnicalError("bare-string").code).toBe(
      "DEPENDENCY_FAILURE",
    );
    const existing = new EligibilityError("RULE_VERSION_INVALID");
    expect(normalizeEligibilityTechnicalError(existing)).toBe(existing);
    expect(normalizeEligibilityPersistenceError(existing)).toBe(existing);
  });
});

describe("evaluateEligibility conflict retries", () => {
  it("succeeds on the second attempt with the same evaluatedAt", async () => {
    let attempts = 0;
    const evaluatedAts: string[] = [];
    const insert = vi.fn().mockImplementation(async (row: { evaluatedAt: Date }) => {
      attempts += 1;
      evaluatedAts.push(row.evaluatedAt.toISOString());
      if (attempts === 1) {
        throw Object.assign(new Error("pricing conflict"), { code: "CONFLICT" });
      }
      return { evaluationId: "ok" };
    });
    const runRepeatableRead = vi.fn(async (work) =>
      work({
        eligibility: {
          findEffectiveRuleVersion: vi.fn().mockResolvedValue({
            id: R1_P11_ELIGIBILITY_RULE_SEED.id,
            countryId: R1_P11_IDS.countryId,
            versionLabel: R1_P11_ELIGIBILITY_RULE_SEED.versionLabel,
            schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
            engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
            ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
            parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
            effectiveFrom: R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom,
            contentChecksum: RULE_CHECKSUM,
            createdAt: new Date(),
          }),
          insertEvaluationWithCandidates: insert,
        } as unknown as PrismaEligibilityRepository,
        transaction: {},
      }),
    );
    const deps: EligibilityApplicationServiceDependencies = {
      unitOfWork: { runRepeatableRead } as unknown as EligibilityUnitOfWork,
      clock: () => new Date(R1_P11_TIMES.evaluatedAt),
      ...emptyDiscoveryFactories(),
    };
    const service = createEligibilityApplicationService(deps);
    const result = await service.evaluateEligibility(buildDiscoveryRequest());
    expect(result.metadata.evaluatedAt).toBe(R1_P11_TIMES.evaluatedAt);
    expect(runRepeatableRead).toHaveBeenCalledTimes(2);
    expect(evaluatedAts).toEqual([
      R1_P11_TIMES.evaluatedAt,
      R1_P11_TIMES.evaluatedAt,
    ]);
  });

  it("succeeds on the third attempt", async () => {
    let attempts = 0;
    const insert = vi.fn().mockImplementation(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error("tx"), { code: "P2034" });
      }
      return { evaluationId: "ok" };
    });
    const runRepeatableRead = vi.fn(async (work) =>
      work({
        eligibility: {
          findEffectiveRuleVersion: vi.fn().mockResolvedValue({
            id: R1_P11_ELIGIBILITY_RULE_SEED.id,
            countryId: R1_P11_IDS.countryId,
            versionLabel: R1_P11_ELIGIBILITY_RULE_SEED.versionLabel,
            schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
            engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
            ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
            parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
            effectiveFrom: R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom,
            contentChecksum: RULE_CHECKSUM,
            createdAt: new Date(),
          }),
          insertEvaluationWithCandidates: insert,
        } as unknown as PrismaEligibilityRepository,
        transaction: {},
      }),
    );
    const service = createEligibilityApplicationService({
      unitOfWork: { runRepeatableRead } as unknown as EligibilityUnitOfWork,
      clock: () => new Date(R1_P11_TIMES.evaluatedAt),
      ...emptyDiscoveryFactories(),
    });
    await expect(
      service.evaluateEligibility(buildDiscoveryRequest()),
    ).resolves.toMatchObject({ metadata: { evaluatedAt: R1_P11_TIMES.evaluatedAt } });
    expect(runRepeatableRead).toHaveBeenCalledTimes(3);
  });

  it("exhausts after exactly three attempts", async () => {
    const runRepeatableRead = vi.fn(async () => {
      throw Object.assign(new Error("pricing"), { code: "CONFLICT" });
    });
    const service = createEligibilityApplicationService({
      unitOfWork: { runRepeatableRead } as unknown as EligibilityUnitOfWork,
      clock: () => new Date(R1_P11_TIMES.evaluatedAt),
      ...emptyDiscoveryFactories(),
    });
    await expect(
      service.evaluateEligibility(buildDiscoveryRequest()),
    ).rejects.toMatchObject({ code: "TRANSACTION_CONFLICT_EXHAUSTED" });
    expect(runRepeatableRead).toHaveBeenCalledTimes(3);
  });

  it("retries pricing-reader structural CONFLICT", async () => {
    let pricingCalls = 0;
    const runRepeatableRead = vi.fn(async (work) =>
      work({
        eligibility: {
          findEffectiveRuleVersion: vi.fn().mockResolvedValue({
            id: R1_P11_ELIGIBILITY_RULE_SEED.id,
            countryId: R1_P11_IDS.countryId,
            versionLabel: R1_P11_ELIGIBILITY_RULE_SEED.versionLabel,
            schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
            engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
            ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
            parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
            effectiveFrom: R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom,
            contentChecksum: RULE_CHECKSUM,
            createdAt: new Date(),
          }),
          insertEvaluationWithCandidates: vi.fn().mockResolvedValue({}),
        } as unknown as PrismaEligibilityRepository,
        transaction: {},
      }),
    );
    const factories = emptyDiscoveryFactories();
    const service = createEligibilityApplicationService({
      unitOfWork: { runRepeatableRead } as unknown as EligibilityUnitOfWork,
      clock: () => new Date(R1_P11_TIMES.evaluatedAt),
      ...factories,
      createAvailabilityReader: () =>
        ({
          discoverProviderIds: vi.fn().mockResolvedValue({
            status: "OK",
            providerIds: [R1_P11_IDS.providerId],
          }),
          getAvailabilityFacts: vi.fn().mockResolvedValue({
            status: "AVAILABLE_FACTS",
            providerId: R1_P11_IDS.providerId,
            coverageMatch: true,
            providerScheduleAvailable: true,
            paused: false,
            suspended: false,
            simultaneousTeamLimit: 1,
            teams: [],
          }),
        }) as never,
      createLifecycleReader: () =>
        ({
          getLifecycleFacts: vi.fn().mockResolvedValue({
            status: "PRESENT",
            providerId: R1_P11_IDS.providerId,
            approved: true,
            live: true,
            suspended: false,
            verificationSatisfiedOrNotRequired: true,
            aggregateVersion: "1",
          }),
        }) as never,
      createPricingReader: () =>
        ({
          getEligibilityPricingFacts: vi.fn().mockImplementation(async () => {
            pricingCalls += 1;
            if (pricingCalls === 1) {
              throw Object.assign(new Error("PROVIDER_SERVICE_SNAPSHOT_CONFLICT"), {
                code: "CONFLICT",
              });
            }
            return {
              status: "UNAVAILABLE",
              providerId: R1_P11_IDS.providerId,
              serviceId: R1_P11_IDS.serviceId,
              reason: "OFFERING_OR_PRICE_UNAVAILABLE",
              sourceVersion: null,
            };
          }),
        }) as never,
    });
    await service.evaluateEligibility(buildDiscoveryRequest());
    expect(pricingCalls).toBe(2);
    expect(runRepeatableRead).toHaveBeenCalledTimes(2);
  });

  it("fails immediately for non-retryable dependency outages", async () => {
    const runRepeatableRead = vi.fn(async () => {
      throw Object.assign(new Error("catalog down"), {
        code: "DEPENDENCY_FAILURE",
      });
    });
    const service = createEligibilityApplicationService({
      unitOfWork: { runRepeatableRead } as unknown as EligibilityUnitOfWork,
      clock: () => new Date(R1_P11_TIMES.evaluatedAt),
      ...emptyDiscoveryFactories(),
    });
    await expect(
      service.evaluateEligibility(buildDiscoveryRequest()),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
    expect(runRepeatableRead).toHaveBeenCalledTimes(1);
  });
});
