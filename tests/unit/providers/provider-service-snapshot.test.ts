
import type { ProviderServiceUnitOfWork } from "../../../src/modules/providers/domain/provider-service.ports.js";
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import { ProviderServiceSnapshotService } from "../../../src/modules/providers/provider-service-snapshot.service.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
  createFakeCatalogDefinitionReader,
  createFakePricingPolicyReader,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

const FORBIDDEN_MARKERS = [
  "PENDING",
  "REJECTED",
  "SUPERSEDED",
  "staffReason",
  "reasonText",
  "receipt",
  "idempotencyKey",
  "requestFingerprint",
  "operationalEmail",
  "operationalPhone",
  "whatsapp",
  "DATABASE_URL",
  "prisma",
  "password",
  "secret",
] as const;

function effectivePrice(overrides: Record<string, unknown> = {}) {
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
    currencyDecimalPlaces: R1_P09_SENTINELS.currencyDecimalPlaces,
    providerPriceMinorUnits: "12000",
    minimumChargeMinorUnits: "15000",
    maximumPriceMinorUnitsAtProposal: "999999",
    approvalRequiredAtProposal: false,
    status: "EFFECTIVE" as const,
    proposedByUserId: R1_P09_IDS.ownerUserId,
    effectiveAt: new Date("2026-09-05T12:00:00.000Z"),
    rejectedAt: null,
    supersededAt: null,
    createdAt: new Date("2026-09-05T11:00:00.000Z"),
    ...overrides,
  };
}

function offering(overrides: Record<string, unknown> = {}) {
  return {
    id: R1_P09_IDS.providerServiceId,
    providerId: R1_P09_IDS.providerId,
    catalogServiceId: R1_P09_IDS.catalogServiceId,
    enabled: true,
    estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
    noteAr: R1_P09_SENTINELS.noteAr,
    noteEn: R1_P09_SENTINELS.noteEn,
    version: 2,
    createdAt: new Date("2026-09-05T10:00:00.000Z"),
    updatedAt: new Date("2026-09-05T11:00:00.000Z"),
    ...overrides,
  };
}

function createUnitOfWork(options?: {
  readonly failTimes?: number;
  readonly matched?: {
    readonly offering: ReturnType<typeof offering>;
    readonly effectivePrice: ReturnType<typeof effectivePrice>;
  } | null;
  readonly catalog?: ReturnType<typeof createFakeCatalogDefinitionReader>;
  readonly pricing?: ReturnType<typeof createFakePricingPolicyReader>;
}): {
  readonly unitOfWork: ProviderServiceUnitOfWork;
  readonly runReadSnapshot: ReturnType<typeof vi.fn>;
  readonly bookingWriteSpy: ReturnType<typeof vi.fn>;
} {
  let failuresLeft = options?.failTimes ?? 0;
  const catalog = options?.catalog ?? createFakeCatalogDefinitionReader();
  const pricing = options?.pricing ?? createFakePricingPolicyReader();
  const matched =
    options?.matched === undefined
      ? {
          offering: offering(),
          effectivePrice: effectivePrice(),
        }
      : options.matched;
  const bookingWriteSpy = vi.fn();

  const runReadSnapshot = vi.fn(
    async <T>(
      work: (context: {
        providerServices: {
          lockProviderScope: ReturnType<typeof vi.fn>;
          findEnabledOfferingWithEffectivePrice: ReturnType<typeof vi.fn>;
        };
        catalog: typeof catalog;
        pricingPolicy: typeof pricing;
      }) => Promise<T>,
    ) => {
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
          undefined,
          { details: { reason: "SERIALIZATION_FAILURE" } },
        );
      }
      return work({
        providerServices: {
          lockProviderScope: vi.fn(async () => ({
            id: R1_P09_IDS.providerId,
            applicationStatus: "APPROVED",
            operationalStatus: "INACTIVE",
            countryId: R1_P09_IDS.countryId,
            countryCode: R1_P09_IDS.countryCode,
          })),
          findEnabledOfferingWithEffectivePrice: vi.fn(async () => matched),
        },
        catalog,
        pricingPolicy: pricing,
      });
    },
  );

  return {
    unitOfWork: {
      runMutation: vi.fn(),
      runReadSnapshot,
    } as unknown as ProviderServiceUnitOfWork,
    runReadSnapshot,
    bookingWriteSpy,
  };
}

describe("provider-service-snapshot.service (T057/T063)", () => {
  it("returns AVAILABLE with every DEC-051 field for a usable offering", async () => {
    const harness = createUnitOfWork();
    const service = new ProviderServiceSnapshotService({
      unitOfWork: harness.unitOfWork,
    });

    const result = await service.getSnapshotReadyFacts({
      providerId: R1_P09_IDS.providerId,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      countryCode: R1_P09_IDS.countryCode,
      locale: "AR",
    });

    expect(result.status).toBe("AVAILABLE");
    if (result.status !== "AVAILABLE") {
      throw new Error("expected AVAILABLE");
    }
    expect(result.value).toMatchObject({
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServiceVersion: 2,
      catalogServiceId: R1_P09_IDS.catalogServiceId,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      catalogServiceVersion: 1,
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      serviceNote: R1_P09_SENTINELS.noteAr,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      price: "120.00",
      minimumCharge: "150.00",
      currencyCode: R1_P09_IDS.currencyCode,
      effectiveAt: "2026-09-05T12:00:00.000Z",
      priceUnit: {
        id: R1_P09_IDS.catalogPriceUnitId,
        code: R1_P09_IDS.catalogPriceUnitCode,
        label: "Per visit",
      },
    });
    expect(result.value.catalogDefinition.locale).toBe("AR");
    expect(result.value.catalogDefinition.countryCode).toBe(
      R1_P09_IDS.countryCode,
    );
    expect(harness.runReadSnapshot).toHaveBeenCalledTimes(1);
    expect(harness.bookingWriteSpy).not.toHaveBeenCalled();
  });

  it("uses exact EN note and does not fall back to AR", async () => {
    const harness = createUnitOfWork({
      matched: {
        offering: offering({ noteAr: "عربي", noteEn: "English only" }),
        effectivePrice: effectivePrice(),
      },
    });
    const service = new ProviderServiceSnapshotService({
      unitOfWork: harness.unitOfWork,
    });
    const result = await service.getSnapshotReadyFacts({
      providerId: R1_P09_IDS.providerId,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      countryCode: R1_P09_IDS.countryCode,
      locale: "EN",
    });
    expect(result.status).toBe("AVAILABLE");
    if (result.status === "AVAILABLE") {
      expect(result.value.serviceNote).toBe("English only");
      expect(result.value.catalogDefinition.locale).toBe("EN");
    }
  });

  it("collapses disabled or missing effective matches to UNAVAILABLE", async () => {
    const harness = createUnitOfWork({ matched: null });
    const service = new ProviderServiceSnapshotService({
      unitOfWork: harness.unitOfWork,
    });
    await expect(
      service.getSnapshotReadyFacts({
        providerId: R1_P09_IDS.providerId,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        countryCode: R1_P09_IDS.countryCode,
        locale: "EN",
      }),
    ).resolves.toEqual({ status: "UNAVAILABLE" });
  });

  it("excludes pending/Staff/contact/receipt/raw markers from AVAILABLE output", async () => {
    const harness = createUnitOfWork();
    const service = new ProviderServiceSnapshotService({
      unitOfWork: harness.unitOfWork,
    });
    const result = await service.getSnapshotReadyFacts({
      providerId: R1_P09_IDS.providerId,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      countryCode: R1_P09_IDS.countryCode,
      locale: "EN",
    });
    const serialized = JSON.stringify(result);
    for (const marker of FORBIDDEN_MARKERS) {
      expect(serialized.toLowerCase()).not.toContain(marker.toLowerCase());
    }
  });

  it("retries whole-transaction serialization failures and returns CONFLICT on third failure", async () => {
    const harness = createUnitOfWork({ failTimes: 3 });
    const service = new ProviderServiceSnapshotService({
      unitOfWork: harness.unitOfWork,
    });
    await expect(
      service.getSnapshotReadyFacts({
        providerId: R1_P09_IDS.providerId,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        countryCode: R1_P09_IDS.countryCode,
        locale: "EN",
      }),
    ).resolves.toEqual({
      status: "CONFLICT",
      code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
    });
    expect(harness.runReadSnapshot).toHaveBeenCalledTimes(3);
  });

  it("succeeds after a transient serialization failure within three attempts", async () => {
    const harness = createUnitOfWork({ failTimes: 2 });
    const service = new ProviderServiceSnapshotService({
      unitOfWork: harness.unitOfWork,
    });
    const result = await service.getSnapshotReadyFacts({
      providerId: R1_P09_IDS.providerId,
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      countryCode: R1_P09_IDS.countryCode,
      locale: "EN",
    });
    expect(result.status).toBe("AVAILABLE");
    expect(harness.runReadSnapshot).toHaveBeenCalledTimes(3);
  });
});
