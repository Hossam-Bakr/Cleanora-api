
import {
  evaluateOfferingUsability,
  evaluateProviderServicesReadiness,
  PROVIDER_SERVICES_READY_BLOCKER_PRECEDENCE,
  selectExactLocaleServiceNote,
} from "../../../src/modules/providers/domain/provider-service-readiness.policy.js";
import { calculateMarketplaceReadiness } from "../../../src/modules/providers/domain/provider-readiness.policy.js";
import { PROVIDER_SERVICES_READY_BLOCKER_CODES } from "../../../src/modules/providers/domain/provider-service.types.js";

function usableOffering(
  overrides: Partial<Parameters<typeof evaluateOfferingUsability>[0]> = {},
) {
  return evaluateOfferingUsability({
    enabled: true,
    estimatedDurationMinutes: 90,
    noteAr: null,
    noteEn: null,
    catalogSelectable: true,
    priceUnitActive: true,
    hasEffectivePrice: true,
    hasPendingPrice: false,
    pricingConfigurationValid: true,
    ...overrides,
  });
}

describe("provider-service-readiness.policy (T055/T060)", () => {
  it("satisfies servicesReady for one qualifying enabled offering on an approved Provider", () => {
    const evaluation = usableOffering();
    expect(evaluation.usable).toBe(true);
    expect(evaluation.blockerCodes).toEqual([]);

    const facts = evaluateProviderServicesReadiness({
      providerId: "provider-1",
      providerApproved: true,
      offerings: [
        {
          enabled: true,
          usable: true,
          blockerCodes: [],
        },
      ],
    });
    expect(facts).toEqual({
      providerId: "provider-1",
      servicesReady: true,
      qualifyingOfferingCount: 1,
      blockerCodes: [],
    });
  });

  it.each([
    ["NO_PROVIDER_SERVICES", { offerings: [] as const }],
    [
      "NO_ENABLED_PROVIDER_SERVICE",
      {
        offerings: [
          {
            enabled: false,
            usable: false,
            blockerCodes: ["NO_EFFECTIVE_PRICE"] as const,
          },
        ],
      },
    ],
  ] as const)("emits aggregate blocker %s", (code, input) => {
    const facts = evaluateProviderServicesReadiness({
      providerId: "provider-1",
      providerApproved: true,
      ...input,
    });
    expect(facts.servicesReady).toBe(false);
    expect(facts.blockerCodes).toEqual([code]);
  });

  it.each([
    [
      "CATALOG_SERVICE_UNAVAILABLE",
      { catalogSelectable: false, hasEffectivePrice: true },
    ],
    [
      "PRICE_UNIT_UNAVAILABLE",
      { priceUnitActive: false, hasEffectivePrice: true },
    ],
    [
      "NO_EFFECTIVE_PRICE",
      { hasEffectivePrice: false, hasPendingPrice: false },
    ],
    [
      "PRICE_APPROVAL_PENDING",
      { hasEffectivePrice: false, hasPendingPrice: true },
    ],
    [
      "OFFERING_CONFIGURATION_INVALID",
      { estimatedDurationMinutes: 0, hasEffectivePrice: true },
    ],
    [
      "OFFERING_CONFIGURATION_INVALID",
      {
        noteAr: "only-ar",
        noteEn: null,
        hasEffectivePrice: true,
      },
    ],
    [
      "OFFERING_CONFIGURATION_INVALID",
      {
        pricingConfigurationValid: false,
        hasEffectivePrice: true,
      },
    ],
  ] as const)("maps exact condition to %s", (code, overrides) => {
    const evaluation = usableOffering(overrides);
    expect(evaluation.usable).toBe(false);
    expect(evaluation.blockerCodes).toContain(code);
    for (const blocker of evaluation.blockerCodes) {
      expect(PROVIDER_SERVICES_READY_BLOCKER_CODES).toContain(blocker);
    }
  });

  it("deduplicates and sorts aggregate blockers by approved precedence", () => {
    const facts = evaluateProviderServicesReadiness({
      providerId: "provider-1",
      providerApproved: true,
      offerings: [
        {
          enabled: true,
          usable: false,
          blockerCodes: [
            "OFFERING_CONFIGURATION_INVALID",
            "CATALOG_SERVICE_UNAVAILABLE",
          ],
        },
        {
          enabled: true,
          usable: false,
          blockerCodes: [
            "CATALOG_SERVICE_UNAVAILABLE",
            "PRICE_UNIT_UNAVAILABLE",
            "NO_EFFECTIVE_PRICE",
          ],
        },
      ],
    });
    expect(facts.servicesReady).toBe(false);
    expect(facts.blockerCodes).toEqual([
      "CATALOG_SERVICE_UNAVAILABLE",
      "PRICE_UNIT_UNAVAILABLE",
      "NO_EFFECTIVE_PRICE",
      "OFFERING_CONFIGURATION_INVALID",
    ]);
    expect(PROVIDER_SERVICES_READY_BLOCKER_PRECEDENCE).toEqual([
      ...PROVIDER_SERVICES_READY_BLOCKER_CODES,
    ]);
  });

  it("keeps servicesReady false when Provider is not approved even with usable offerings", () => {
    const facts = evaluateProviderServicesReadiness({
      providerId: "provider-1",
      providerApproved: false,
      offerings: [{ enabled: true, usable: true, blockerCodes: [] }],
    });
    expect(facts.servicesReady).toBe(false);
    expect(facts.qualifyingOfferingCount).toBe(1);
    expect(facts.blockerCodes).toEqual([]);
  });

  it("never inspects LIVE, coverage, schedule, or capacity inputs", () => {
    const evaluation = usableOffering();
    expect(Object.keys(evaluation)).toEqual(["usable", "blockerCodes"]);
    expect(JSON.stringify(evaluation)).not.toMatch(
      /LIVE|coverage|schedule|capacity|eligibleForPublicBrowse/i,
    );
  });

  it("keeps eligibleForPublicBrowse literally false when servicesReady is injected", () => {
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "LIVE",
      profileCompletionPercentage: 100,
      servicesReady: {
        satisfied: true,
        blockerCodes: [],
      },
    });
    expect(readiness.eligibleForPublicBrowse).toBe(false);
    const servicesGate = readiness.gates.find(
      (gate) => gate.key === "servicesReady",
    );
    expect(servicesGate).toMatchObject({
      status: "SATISFIED",
      satisfied: true,
      owningPhase: "R1-P09",
      blockerCodes: [],
    });
    const browseGate = readiness.gates.find(
      (gate) => gate.key === "eligibleForPublicBrowse",
    );
    expect(browseGate?.satisfied).toBe(false);
  });

  it("selects exact-locale notes without fallback", () => {
    expect(
      selectExactLocaleServiceNote({
        locale: "AR",
        noteAr: "عربي",
        noteEn: "English",
      }),
    ).toBe("عربي");
    expect(
      selectExactLocaleServiceNote({
        locale: "EN",
        noteAr: "عربي",
        noteEn: "English",
      }),
    ).toBe("English");
    expect(
      selectExactLocaleServiceNote({
        locale: "EN",
        noteAr: null,
        noteEn: null,
      }),
    ).toBeNull();
  });
});
