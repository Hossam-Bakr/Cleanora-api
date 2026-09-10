/**
 * Evaluate orchestration with fakes — catalog-unavailable persists empty set
 * (Batch G coverage for eligibility.service.ts).
 */

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  createEligibilityApplicationService,
  type EligibilityApplicationServiceDependencies,
} from "#modules/eligibility/eligibility.service";
import type { EligibilityUnitOfWork } from "#modules/eligibility/infrastructure/eligibility.unit-of-work";
import type { PrismaEligibilityRepository } from "#modules/eligibility/infrastructure/prisma-eligibility.repository";
import {
  buildBrowseCandidatesRequest,
  buildDiscoveryRequest,
  R1_P11_IDS,
  R1_P11_TIMES,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";
import { buildExplicitRequest } from "../../../helpers/r1-p11-eligibility-fixtures.js";
import {
  computeR1P11EligibilityRuleContentChecksum,
  R1_P11_ELIGIBILITY_RULE_SEED,
} from "../../../../prisma/seed.js";

type DepFactoryOverrides = Partial<
  Pick<
    EligibilityApplicationServiceDependencies,
    | "createActiveCountryReader"
    | "createLocalityReader"
    | "createCountryTimeZoneReader"
    | "createCatalogReader"
    | "createPricingReader"
    | "createLifecycleReader"
    | "createAvailabilityReader"
  >
>;

const R1_P11_RULE_CHECKSUM = computeR1P11EligibilityRuleContentChecksum({
  schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
  engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
  ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
  parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
});

function buildDeps(overrides: {
  readonly repository: Partial<PrismaEligibilityRepository>;
  readonly catalogReference?: unknown;
  readonly factories?: DepFactoryOverrides;
}): EligibilityApplicationServiceDependencies {
  const repository = {
    findEffectiveRuleVersion: vi.fn().mockResolvedValue({
      id: R1_P11_ELIGIBILITY_RULE_SEED.id,
      countryId: R1_P11_IDS.countryId,
      versionLabel: R1_P11_ELIGIBILITY_RULE_SEED.versionLabel,
      schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
      engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
      ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
      parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
      effectiveFrom: R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom,
      contentChecksum: R1_P11_RULE_CHECKSUM,
      createdAt: new Date(),
    }),
    insertEvaluationWithCandidates: vi.fn().mockResolvedValue({
      evaluationId: "eval-1",
    }),
    ...overrides.repository,
  };

  const unitOfWork = {
    runRepeatableRead: async <T>(
      work: (context: {
        readonly eligibility: typeof repository;
        readonly transaction: unknown;
      }) => Promise<T>,
    ) => work({ eligibility: repository, transaction: {} }),
  } as unknown as EligibilityUnitOfWork;

  const factories = overrides.factories ?? {};

  return {
    unitOfWork,
    clock: () => new Date(R1_P11_TIMES.evaluatedAt),
    createActiveCountryReader:
      factories.createActiveCountryReader ??
      (() =>
        ({
          getActiveCountryById: vi.fn().mockResolvedValue({
            id: R1_P11_IDS.countryId,
            code: "EG",
          }),
        }) as never),
    createLocalityReader:
      factories.createLocalityReader ??
      (() =>
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
        }) as never),
    createCountryTimeZoneReader:
      factories.createCountryTimeZoneReader ??
      (() =>
        ({
          getTimeZoneForCountry: vi.fn().mockResolvedValue("Africa/Cairo"),
        }) as never),
    createCatalogReader:
      factories.createCatalogReader ??
      (() =>
        ({
          getProviderOfferingReference: vi
            .fn()
            .mockResolvedValue(
              overrides.catalogReference === undefined
                ? null
                : overrides.catalogReference,
            ),
        }) as never),
    createPricingReader:
      factories.createPricingReader ??
      (() =>
        ({
          getEligibilityPricingFacts: vi.fn(),
        }) as never),
    createLifecycleReader:
      factories.createLifecycleReader ??
      (() =>
        ({
          getLifecycleFacts: vi.fn(),
        }) as never),
    createAvailabilityReader:
      factories.createAvailabilityReader ??
      (() =>
        ({
          discoverProviderIds: vi.fn().mockResolvedValue({
            status: "OK",
            providerIds: [R1_P11_IDS.providerId],
          }),
          getAvailabilityFacts: vi.fn(),
        }) as never),
  };
}

describe("evaluateEligibility orchestration (fakes)", () => {
  it("persists an empty candidate set when catalog is unavailable", async () => {
    const insert = vi.fn().mockResolvedValue({ evaluationId: "eval-1" });
    const deps = buildDeps({
      repository: { insertEvaluationWithCandidates: insert },
      catalogReference: null,
    });
    const service = createEligibilityApplicationService(deps);
    const result = await service.evaluateEligibility(buildDiscoveryRequest());

    expect(result.evaluationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
    );
    expect(result.eligibleProviders).toEqual([]);
    expect(result.excludedProviders).toEqual([]);
    expect(result.evaluationOutcomes.catalog.status).toBe("FAIL");
    expect(insert).toHaveBeenCalledOnce();
    const insertArg = insert.mock.calls[0]?.[0] as {
      id: string;
      candidates: unknown[];
      expiresAt: Date;
      completedAt: Date;
    };
    expect(insertArg.id).toBe(result.evaluationId);
    expect(insertArg.candidates).toEqual([]);
    expect(
      insertArg.expiresAt.getTime() - insertArg.completedAt.getTime(),
    ).toBe(720 * 60 * 60 * 1000);
  });

  it("fails RULE_VERSION_UNAVAILABLE when no effective rule exists", async () => {
    const deps = buildDeps({
      repository: {
        findEffectiveRuleVersion: vi.fn().mockResolvedValue(null),
      },
    });
    const service = createEligibilityApplicationService(deps);
    await expect(
      service.evaluateEligibility(buildDiscoveryRequest()),
    ).rejects.toMatchObject({ code: "RULE_VERSION_UNAVAILABLE" });
  });

  it("rejects inactive country before persistence", async () => {
    const deps = buildDeps({
      repository: {},
      factories: {
        createActiveCountryReader: () =>
          ({
            getActiveCountryById: vi.fn().mockResolvedValue(null),
          }) as never,
      },
    });
    const service = createEligibilityApplicationService(deps);
    await expect(
      service.evaluateEligibility(buildDiscoveryRequest()),
    ).rejects.toBeInstanceOf(EligibilityError);
  });

  it("evaluates explicit Providers and maps Browse-safe candidates", async () => {
    const insert = vi.fn().mockResolvedValue({ evaluationId: "eval-2" });
    const deps = buildDeps({
      repository: { insertEvaluationWithCandidates: insert },
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: true,
        activePriceUnits: [],
      },
      factories: {
        createLifecycleReader: () =>
          ({
            getLifecycleFacts: vi.fn().mockResolvedValue({
              status: "MISSING",
              providerId: R1_P11_IDS.providerId,
            }),
          }) as never,
        createPricingReader: () =>
          ({
            getEligibilityPricingFacts: vi.fn().mockResolvedValue({
              status: "UNAVAILABLE",
              providerId: R1_P11_IDS.providerId,
              serviceId: R1_P11_IDS.serviceId,
              reason: "OFFERING_OR_PRICE_UNAVAILABLE",
              sourceVersion: null,
            }),
          }) as never,
        createAvailabilityReader: () =>
          ({
            discoverProviderIds: vi.fn().mockResolvedValue({
              status: "OK",
              providerIds: [],
            }),
            getAvailabilityFacts: vi.fn().mockResolvedValue({
              status: "MISSING_CONFIGURATION",
              providerId: R1_P11_IDS.providerId,
              missingConfiguration: [
                "COVERAGE",
                "PROVIDER_SCHEDULE",
                "CAPACITY_RULE",
              ],
              coverageMatch: false,
              providerScheduleAvailable: false,
              paused: false,
              suspended: false,
              simultaneousTeamLimit: null,
              teams: [],
            }),
          }) as never,
      },
    });

    const service = createEligibilityApplicationService(deps);
    const explicit = await service.evaluateEligibility(
      buildExplicitRequest({ providerIds: [R1_P11_IDS.providerId] }),
    );
    expect(explicit.excludedProviders.length).toBe(1);
    expect(explicit.eligibleProviders).toEqual([]);
    expect(insert).toHaveBeenCalled();

    const browse = await service.getStandardBrowseCandidates(
      buildBrowseCandidatesRequest(),
    );
    expect(browse.candidates).toEqual([]);
    expect(browse.metadata.ruleVersionId).toBe(R1_P11_ELIGIBILITY_RULE_SEED.id);
  });

  it("covers district ancestry + catalog-not-in-country branches", async () => {
    const insert = vi.fn().mockResolvedValue({ evaluationId: "eval-3" });
    const deps = buildDeps({
      repository: { insertEvaluationWithCandidates: insert },
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: false,
        activePriceUnits: [],
      },
    });
    const service = createEligibilityApplicationService(deps);
    const result = await service.evaluateEligibility(
      buildDiscoveryRequest({ districtId: R1_P11_IDS.districtId }),
    );
    expect(result.evaluationOutcomes.catalog.status).toBe("FAIL");
    expect(result.evaluationOutcomes.catalog.reasons).toContain(
      "SERVICE_NOT_AVAILABLE_IN_COUNTRY",
    );

    const withBadDistrict = createEligibilityApplicationService(
      buildDeps({
        repository: { insertEvaluationWithCandidates: insert },
        catalogReference: {
          serviceId: R1_P11_IDS.serviceId,
          serviceCode: "STANDARD_HOME_CLEANING",
          selectableForCountry: false,
          activePriceUnits: [],
        },
        factories: {
          createLocalityReader: () =>
            ({
              findCityById: vi.fn().mockResolvedValue({
                id: R1_P11_IDS.cityId,
                countryId: R1_P11_IDS.countryId,
                isActive: true,
                countryActive: true,
              }),
              findDistrictById: vi.fn().mockResolvedValue(null),
            }) as never,
        },
      }),
    );
    await expect(
      withBadDistrict.evaluateEligibility(
        buildDiscoveryRequest({ districtId: R1_P11_IDS.districtId }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejects geo input, unit bounds, and invalid explicit providerIds", async () => {
    const deps = buildDeps({ repository: {} });
    const service = createEligibilityApplicationService(deps);

    await expect(
      service.evaluateEligibility({
        ...buildDiscoveryRequest(),
        geo: { latitude: 30, longitude: 31 },
      } as never),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_GEO_INPUT" });

    await expect(
      service.evaluateEligibility(
        buildDiscoveryRequest({ requiredTeamUnits: 0 }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      service.evaluateEligibility(
        buildDiscoveryRequest({ requiredTeamUnits: 51 }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      service.evaluateEligibility(
        buildExplicitRequest({ providerIds: [] }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      service.evaluateEligibility(
        buildExplicitRequest({ providerIds: [""] }),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      service.getStandardBrowseCandidates({
        ...buildBrowseCandidatesRequest(),
        providerIds: [R1_P11_IDS.providerId],
      } as never),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("fails REQUESTED_INTERVAL_TOO_SHORT on AVAILABLE pricing and persists exclusions", async () => {
    const insert = vi.fn().mockResolvedValue({ evaluationId: "eval-short" });
    const deps = buildDeps({
      repository: { insertEvaluationWithCandidates: insert },
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: true,
        activePriceUnits: [],
      },
      factories: {
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
            getEligibilityPricingFacts: vi.fn().mockResolvedValue({
              status: "AVAILABLE",
              providerId: R1_P11_IDS.providerId,
              serviceId: R1_P11_IDS.serviceId,
              priceAmount: "100.00",
              minimumChargeAmount: "100.00",
              currencyCode: "EGP",
              priceUnitId: "pu-1",
              estimatedDurationMinutes: 180,
              sourceVersion: "1:price",
            }),
          }) as never,
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
              simultaneousTeamLimit: 2,
              teams: [
                {
                  teamId: R1_P11_IDS.teamId,
                  structurallyValid: true,
                  membersAvailableForWholeInterval: true,
                  cleanerGenderCounts: {
                    male: 1,
                    female: 0,
                    otherOrUnspecified: 0,
                  },
                  escortFacts: {
                    escortRequired: false,
                    escortPresentAndValid: true,
                    escortsAvailableForWholeInterval: true,
                  },
                },
              ],
            }),
          }) as never,
      },
    });

    const service = createEligibilityApplicationService(deps);
    const result = await service.evaluateEligibility(buildDiscoveryRequest());
    expect(result.eligibleProviders).toEqual([]);
    expect(result.excludedProviders).toHaveLength(1);
    expect(result.excludedProviders[0]?.reasons).toContain(
      "REQUESTED_INTERVAL_TOO_SHORT",
    );
    expect(insert).toHaveBeenCalled();
  });

  it("persists eligible Providers/Teams and maps Browse candidates", async () => {
    const insert = vi.fn().mockResolvedValue({ evaluationId: "eval-ok" });
    const deps = buildDeps({
      repository: { insertEvaluationWithCandidates: insert },
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: true,
        activePriceUnits: [],
      },
      factories: {
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
            getEligibilityPricingFacts: vi.fn().mockResolvedValue({
              status: "AVAILABLE",
              providerId: R1_P11_IDS.providerId,
              serviceId: R1_P11_IDS.serviceId,
              priceAmount: "100.00",
              minimumChargeAmount: "100.00",
              currencyCode: "EGP",
              priceUnitId: "pu-1",
              estimatedDurationMinutes: 60,
              sourceVersion: "1:price",
            }),
          }) as never,
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
              simultaneousTeamLimit: 2,
              teams: [
                {
                  teamId: R1_P11_IDS.teamId,
                  structurallyValid: true,
                  membersAvailableForWholeInterval: true,
                  cleanerGenderCounts: {
                    male: 1,
                    female: 0,
                    otherOrUnspecified: 0,
                  },
                  escortFacts: {
                    escortRequired: false,
                    escortPresentAndValid: true,
                    escortsAvailableForWholeInterval: true,
                  },
                },
              ],
            }),
          }) as never,
      },
    });

    const service = createEligibilityApplicationService(deps);
    const result = await service.evaluateEligibility(
      buildExplicitRequest({
        providerIds: [R1_P11_IDS.providerId, R1_P11_IDS.providerId],
      }),
    );
    expect(result.eligibleProviders).toHaveLength(1);
    expect(result.eligibleTeams).toHaveLength(1);
    expect(result.eligibleProviders[0]?.sortingFacts).toMatchObject({
      priceAmount: "100.00",
    });

    const browse = await service.getStandardBrowseCandidates(
      buildBrowseCandidatesRequest(),
    );
    expect(browse.candidates).toHaveLength(1);
    expect(browse.candidates[0]?.providerId).toBe(R1_P11_IDS.providerId);
  });

  it("fails discovery OVERFLOW and maps MISSING_CONFIGURATION evidence", async () => {
    const insert = vi.fn().mockResolvedValue({ evaluationId: "eval-miss" });
    const overflowDeps = buildDeps({
      repository: {},
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: true,
        activePriceUnits: [],
      },
      factories: {
        createAvailabilityReader: () =>
          ({
            discoverProviderIds: vi
              .fn()
              .mockResolvedValue({ status: "OVERFLOW" }),
            getAvailabilityFacts: vi.fn(),
          }) as never,
      },
    });
    const overflowService = createEligibilityApplicationService(overflowDeps);
    await expect(
      overflowService.evaluateEligibility(buildDiscoveryRequest()),
    ).rejects.toMatchObject({ code: "EVALUATION_LIMIT_EXCEEDED" });

    const deps = buildDeps({
      repository: { insertEvaluationWithCandidates: insert },
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: true,
        activePriceUnits: [],
      },
      factories: {
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
            getEligibilityPricingFacts: vi.fn().mockResolvedValue({
              status: "AVAILABLE",
              providerId: R1_P11_IDS.providerId,
              serviceId: R1_P11_IDS.serviceId,
              priceAmount: "100.00",
              minimumChargeAmount: "100.00",
              currencyCode: "EGP",
              priceUnitId: "pu-1",
              estimatedDurationMinutes: 60,
              sourceVersion: "1:price",
            }),
          }) as never,
        createAvailabilityReader: () =>
          ({
            discoverProviderIds: vi.fn().mockResolvedValue({
              status: "OK",
              providerIds: [R1_P11_IDS.providerId],
            }),
            getAvailabilityFacts: vi.fn().mockResolvedValue({
              status: "MISSING_CONFIGURATION",
              providerId: R1_P11_IDS.providerId,
              missingConfiguration: ["CAPACITY_RULE"],
              coverageMatch: true,
              providerScheduleAvailable: true,
              paused: false,
              suspended: false,
              simultaneousTeamLimit: null,
              teams: [
                {
                  teamId: R1_P11_IDS.teamId,
                  structurallyValid: true,
                  membersAvailableForWholeInterval: true,
                  cleanerGenderCounts: {
                    male: 1,
                    female: 0,
                    otherOrUnspecified: 0,
                  },
                  escortFacts: {
                    escortRequired: false,
                    escortPresentAndValid: true,
                    escortsAvailableForWholeInterval: true,
                  },
                },
              ],
            }),
          }) as never,
      },
    });

    const service = createEligibilityApplicationService(deps);
    const result = await service.evaluateEligibility(buildDiscoveryRequest());
    expect(result.excludedProviders[0]?.reasons).toContain(
      "CAPACITY_RULE_MISSING",
    );
    expect(result.excludedProviders[0]?.reasons).not.toContain(
      "NO_VALID_COMPLETE_TEAM",
    );
    expect(insert).toHaveBeenCalled();
  });

  it("maps PERSISTENCE_FAILED when insert rejects", async () => {
    const deps = buildDeps({
      repository: {
        insertEvaluationWithCandidates: vi
          .fn()
          .mockRejectedValue(new Error("db down")),
      },
      catalogReference: {
        serviceId: R1_P11_IDS.serviceId,
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: true,
        activePriceUnits: [],
      },
      factories: {
        createAvailabilityReader: () =>
          ({
            discoverProviderIds: vi.fn().mockResolvedValue({
              status: "OK",
              providerIds: [],
            }),
            getAvailabilityFacts: vi.fn(),
          }) as never,
      },
    });
    const service = createEligibilityApplicationService(deps);
    await expect(
      service.evaluateEligibility(buildDiscoveryRequest()),
    ).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
  });
});
