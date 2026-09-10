/**
 * Eligibility lifecycle + pricing reader unit coverage (Batch G).
 */

import { ProviderServiceError } from "#modules/providers/domain/provider-service.errors";
import {
  createBoundEligibilityProviderLifecycleReader,
  EligibilityProviderLifecycleReaderService,
} from "#modules/providers/eligibility-lifecycle.reader";
import { EligibilityPricingReaderService } from "#modules/providers/eligibility-pricing.reader";

const PRICE_UNIT_ID = "pu-eligible-1";
const NOW = new Date("2026-09-05T12:00:00.000Z");

function availablePricingDeps(overrides: {
  readonly enabled?: boolean;
  readonly applicationStatus?: string;
  readonly countryCode?: string | null;
  readonly priceCountryCode?: string;
  readonly effectiveAt?: Date | null;
  readonly selectableForCountry?: boolean;
  readonly activePriceUnits?: readonly { readonly id: string }[];
  readonly lockThrows?: unknown;
} = {}) {
  const offering = {
    id: "ps-1",
    providerId: "p1",
    catalogServiceId: "s1",
    enabled: overrides.enabled ?? true,
    estimatedDurationMinutes: 60,
    noteAr: "ملاحظة",
    noteEn: "note",
    version: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const effectivePrice = {
    id: "price-1",
    providerId: "p1",
    providerServiceId: "ps-1",
    catalogServiceId: "s1",
    catalogPriceUnitId: PRICE_UNIT_ID,
    priceUnitCodeAtProposal: "PER_VISIT",
    countryIdAtProposal: "c1",
    countryCodeAtProposal: overrides.priceCountryCode ?? "EG",
    currencyId: "cur-1",
    currencyCode: "EGP",
    currencyDecimalPlaces: 2,
    providerPriceMinorUnits: "12000",
    minimumChargeMinorUnits: "15000",
    maximumPriceMinorUnitsAtProposal: "999999",
    approvalRequiredAtProposal: false,
    status: "EFFECTIVE" as const,
    proposedByUserId: "u1",
    effectiveAt:
      overrides.effectiveAt === undefined ? NOW : overrides.effectiveAt,
    rejectedAt: null,
    supersededAt: null,
    createdAt: NOW,
  };
  return {
    countries: {
      getActiveCountryById: vi.fn().mockResolvedValue({
        id: "c1",
        code: "EG",
      }),
    } as never,
    providerServices: {
      lockProviderScope: overrides.lockThrows
        ? vi.fn().mockRejectedValue(overrides.lockThrows)
        : vi.fn().mockResolvedValue({
            applicationStatus: overrides.applicationStatus ?? "APPROVED",
            countryCode:
              overrides.countryCode === undefined ? "EG" : overrides.countryCode,
          }),
      findEnabledOfferingWithEffectivePrice: vi.fn().mockResolvedValue({
        offering,
        effectivePrice,
      }),
    } as never,
    catalog: {
      getProviderOfferingReference: vi.fn().mockResolvedValue({
        serviceId: "s1",
        serviceCode: "STANDARD_HOME_CLEANING",
        selectableForCountry: overrides.selectableForCountry ?? true,
        activePriceUnits:
          overrides.activePriceUnits ?? [{ id: PRICE_UNIT_ID }],
      }),
    } as never,
    pricingPolicy: {
      readForCountry: vi.fn().mockResolvedValue({
        status: "AVAILABLE",
        value: {
          countryId: "c1",
          countryCode: "EG",
          currency: {
            id: "cur-1",
            code: "EGP",
            decimalPlaces: 2,
          },
          approvalRequired: false,
          maximumPrice: "9999.99",
        },
      }),
    } as never,
  };
}

describe("EligibilityProviderLifecycleReaderService", () => {
  it("returns MISSING when Provider row is absent", async () => {
    const reader = new EligibilityProviderLifecycleReaderService({
      evaluatedAt: new Date("2026-09-15T08:00:00.000Z"),
      database: {
        provider: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as never,
    });
    await expect(reader.getLifecycleFacts("p-missing")).resolves.toEqual({
      status: "MISSING",
      providerId: "p-missing",
    });
  });

  it("returns PRESENT facts for an approved live Individual Team", async () => {
    const reader = new EligibilityProviderLifecycleReaderService({
      evaluatedAt: new Date("2026-09-15T08:00:00.000Z"),
      database: {
        provider: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p1",
            kind: "INDIVIDUAL_TEAM",
            applicationStatus: "APPROVED",
            operationalStatus: "LIVE",
            version: 3,
            profile: { countryId: "c1" },
          }),
        },
        verificationDocumentPolicyVersion: {
          findFirst: vi.fn(),
        },
        providerDocumentChain: {
          findMany: vi.fn(),
        },
      } as never,
    });
    await expect(reader.getLifecycleFacts("p1")).resolves.toEqual({
      status: "PRESENT",
      providerId: "p1",
      approved: true,
      live: true,
      suspended: false,
      verificationSatisfiedOrNotRequired: true,
      aggregateVersion: "3",
    });
  });

  it("marks Registered Company without approvals as verification unsatisfied", async () => {
    const reader = new EligibilityProviderLifecycleReaderService({
      evaluatedAt: new Date("2026-09-15T08:00:00.000Z"),
      database: {
        provider: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-co",
            kind: "REGISTERED_COMPANY",
            applicationStatus: "APPROVED",
            operationalStatus: "LIVE",
            version: 2,
            profile: { countryId: "c1" },
          }),
        },
        verificationDocumentPolicyVersion: {
          findFirst: vi.fn().mockResolvedValue({
            items: [
              {
                isRequired: true,
                documentType: { code: "COMMERCIAL_REGISTER" },
              },
            ],
          }),
        },
        providerDocumentChain: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as never,
    });
    const facts = await reader.getLifecycleFacts("p-co");
    expect(facts).toMatchObject({
      status: "PRESENT",
      verificationSatisfiedOrNotRequired: false,
    });
  });

  it("satisfies Registered Company when required documents are approved", async () => {
    const reader = new EligibilityProviderLifecycleReaderService({
      evaluatedAt: new Date("2026-09-15T08:00:00.000Z"),
      database: {
        provider: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-co",
            kind: "REGISTERED_COMPANY",
            applicationStatus: "APPROVED",
            operationalStatus: "LIVE",
            version: 2,
            profile: { countryId: "c1" },
          }),
        },
        verificationDocumentPolicyVersion: {
          findFirst: vi.fn().mockResolvedValue({
            items: [
              {
                isRequired: true,
                documentType: { code: "COMMERCIAL_REGISTER" },
              },
            ],
          }),
        },
        providerDocumentChain: {
          findMany: vi.fn().mockResolvedValue([
            { documentType: { code: "COMMERCIAL_REGISTER" } },
          ]),
        },
      } as never,
    });
    const facts = await reader.getLifecycleFacts("p-co");
    expect(facts).toMatchObject({
      verificationSatisfiedOrNotRequired: true,
    });
  });

  it("aborts when verification dependency fails", async () => {
    const reader = new EligibilityProviderLifecycleReaderService({
      evaluatedAt: new Date("2026-09-15T08:00:00.000Z"),
      database: {
        provider: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-co",
            kind: "REGISTERED_COMPANY",
            applicationStatus: "APPROVED",
            operationalStatus: "LIVE",
            version: 1,
            profile: { countryId: "c1" },
          }),
        },
        verificationDocumentPolicyVersion: {
          findFirst: vi.fn().mockRejectedValue(new Error("db down")),
        },
        providerDocumentChain: {
          findMany: vi.fn(),
        },
      } as never,
    });
    await expect(reader.getLifecycleFacts("p-co")).rejects.toMatchObject({
      code: "DEPENDENCY_FAILURE",
    });
  });

  it("honors verification override and bound factory", async () => {
    const verify = vi.fn().mockResolvedValue(false);
    const bound = createBoundEligibilityProviderLifecycleReader(
      {
        provider: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p2",
            kind: "INDIVIDUAL_TEAM",
            applicationStatus: "APPROVED",
            operationalStatus: "SUSPENDED",
            version: 1,
            profile: { countryId: "c1" },
          }),
        },
      },
      { isVerificationSatisfiedOrNotRequired: verify },
    );
    const facts = await bound.getLifecycleFacts("p2");
    expect(facts).toMatchObject({
      status: "PRESENT",
      live: false,
      suspended: true,
      verificationSatisfiedOrNotRequired: false,
    });
    expect(verify).toHaveBeenCalledWith("p2");
  });
});

describe("EligibilityPricingReaderService", () => {
  it("returns UNAVAILABLE when country is inactive/unknown", async () => {
    const reader = new EligibilityPricingReaderService({
      countries: {
        getActiveCountryById: vi.fn().mockResolvedValue(null),
      } as never,
      providerServices: {} as never,
      catalog: {} as never,
      pricingPolicy: {} as never,
    });
    await expect(
      reader.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toEqual({
      status: "UNAVAILABLE",
      providerId: "p1",
      serviceId: "s1",
      reason: "OFFERING_OR_PRICE_UNAVAILABLE",
      sourceVersion: null,
    });
  });

  it("returns UNAVAILABLE when offering/price is missing", async () => {
    const reader = new EligibilityPricingReaderService({
      countries: {
        getActiveCountryById: vi.fn().mockResolvedValue({
          id: "c1",
          code: "EG",
        }),
      } as never,
      providerServices: {
        lockProviderScope: vi.fn().mockResolvedValue({
          applicationStatus: "APPROVED",
          countryCode: "EG",
        }),
        findEnabledOfferingWithEffectivePrice: vi.fn().mockResolvedValue(null),
      } as never,
      catalog: {
        getProviderOfferingReference: vi.fn().mockResolvedValue({
          serviceId: "s1",
          serviceCode: "STANDARD_HOME_CLEANING",
          selectableForCountry: true,
          activePriceUnits: [],
        }),
      } as never,
      pricingPolicy: {} as never,
    });
    await expect(
      reader.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });
  });

  it("returns AVAILABLE for an approved usable offering (no interval check)", async () => {
    const reader = new EligibilityPricingReaderService(availablePricingDeps());
    await expect(
      reader.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toEqual({
      status: "AVAILABLE",
      providerId: "p1",
      serviceId: "s1",
      priceAmount: "120.00",
      minimumChargeAmount: "150.00",
      currencyCode: "EGP",
      priceUnitId: PRICE_UNIT_ID,
      estimatedDurationMinutes: 60,
      sourceVersion: "2:price-1",
    });
  });

  it("returns UNAVAILABLE for unapproved Provider, non-selectable catalog, and country mismatch", async () => {
    const unapproved = new EligibilityPricingReaderService(
      availablePricingDeps({ applicationStatus: "PENDING" }),
    );
    await expect(
      unapproved.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });

    const catalogBlocked = new EligibilityPricingReaderService(
      availablePricingDeps({ selectableForCountry: false }),
    );
    await expect(
      catalogBlocked.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });

    const mismatched = new EligibilityPricingReaderService(
      availablePricingDeps({ countryCode: "SA" }),
    );
    await expect(
      mismatched.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });

    const nullEffective = new EligibilityPricingReaderService(
      availablePricingDeps({ effectiveAt: null }),
    );
    await expect(
      nullEffective.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });
  });

  it("returns UNAVAILABLE when offering usability fails and remaps serialization conflicts", async () => {
    const disabled = new EligibilityPricingReaderService(
      availablePricingDeps({ enabled: false }),
    );
    await expect(
      disabled.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });

    const inactiveUnit = new EligibilityPricingReaderService(
      availablePricingDeps({ activePriceUnits: [{ id: "other-unit" }] }),
    );
    await expect(
      inactiveUnit.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });

    const conflict = new EligibilityPricingReaderService(
      availablePricingDeps({
        lockThrows: new ProviderServiceError(
          "PROVIDER_SERVICE_VERSION_CONFLICT",
          undefined,
          { details: { reason: "SERIALIZATION_FAILURE" } },
        ),
      }),
    );
    await expect(
      conflict.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).rejects.toMatchObject({
      message: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
      code: "CONFLICT",
    });

    const other = new EligibilityPricingReaderService(
      availablePricingDeps({
        lockThrows: new Error("boom"),
      }),
    );
    await expect(
      other.getEligibilityPricingFacts({
        providerId: "p1",
        serviceId: "s1",
        countryId: "c1",
      }),
    ).rejects.toThrow("boom");
  });
});
