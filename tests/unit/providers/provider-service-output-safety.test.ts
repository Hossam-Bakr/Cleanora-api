
import {
  assertSafeProviderServiceOutput,
  toProviderServiceManagementDto,
  toProviderServicePriceManagementDto,
} from "../../../src/modules/providers/provider-service.dto.js";
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";
import {
  createProviderServiceBodySchema,
} from "../../../src/modules/providers/provider-service.schema.js";

describe("provider-service output safety (T027)", () => {
  const price = {
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
    approvalRequiredAtProposal: false,
    status: "EFFECTIVE" as const,
    proposedByUserId: R1_P09_IDS.ownerUserId,
    effectiveAt: new Date("2026-09-05T12:00:00.000Z"),
    rejectedAt: null,
    supersededAt: null,
    createdAt: new Date("2026-09-05T12:00:00.000Z"),
  };

  it("maps money as canonical decimal strings and omits receipt/prisma markers", () => {
    const dto = toProviderServicePriceManagementDto(price);
    expect(dto.price).toBe("120.00");
    expect(dto.minimumCharge).toBe("150.00");
    expect(JSON.stringify(dto)).not.toMatch(/prisma|receipt|fingerprint|safeResult/iu);
  });

  it("maps management DTO without contacts, secrets, or client totals", () => {
    const dto = toProviderServiceManagementDto({
      offering: {
        id: R1_P09_IDS.providerServiceId,
        providerId: R1_P09_IDS.providerId,
        catalogServiceId: R1_P09_IDS.catalogServiceId,
        enabled: false,
        estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
        noteAr: R1_P09_SENTINELS.noteAr,
        noteEn: R1_P09_SENTINELS.noteEn,
        version: 1,
        createdAt: new Date("2026-09-05T12:00:00.000Z"),
        updatedAt: new Date("2026-09-05T12:00:00.000Z"),
      },
      catalogReference: {
        serviceId: R1_P09_IDS.catalogServiceId,
        serviceCode: R1_P09_IDS.catalogServiceCode,
        serviceVersion: 1,
        selectableForCountry: true,
        activePriceUnits: [
          {
            id: R1_P09_IDS.catalogPriceUnitId,
            code: R1_P09_IDS.catalogPriceUnitCode,
          },
        ],
      },
      effectivePrice: price,
      pendingPrice: null,
    });

    expect(dto.effectivePrice?.price).toBe("120.00");
    expect(dto).not.toHaveProperty("total");
    expect(dto).not.toHaveProperty("subtotal");
    expect(JSON.stringify(dto)).not.toMatch(
      /contact|password|token|databaseUrl|stack|receipt/iu,
    );
  });

  it("rejects unsafe output keys", () => {
    expect(() =>
      assertSafeProviderServiceOutput({ receiptFingerprint: "abc" }),
    ).toThrow(ProviderServiceError);
    expect(() =>
      assertSafeProviderServiceOutput({ databaseUrl: "postgres://x" }),
    ).toThrow(ProviderServiceError);
  });

  it("strict create schema rejects client totals, fees, currency, and actor fields", () => {
    const base = {
      catalogServiceCode: R1_P09_IDS.catalogServiceCode,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      price: R1_P09_SENTINELS.providerPrice,
      minimumCharge: R1_P09_SENTINELS.minimumCharge,
      estimatedDurationMinutes: R1_P09_SENTINELS.estimatedDurationMinutes,
      expectedVersion: 0 as const,
      idempotencyKey: R1_P09_IDS.idempotencyKey,
    };

    for (const forbidden of [
      { total: "999.00" },
      { fee: "10.00" },
      { tax: "5.00" },
      { discount: "1.00" },
      { currency: "EGP" },
      { actorUserId: R1_P09_IDS.ownerUserId },
      { deposit: "50.00" },
      { commission: "2.00" },
      { payable: "100.00" },
    ]) {
      const parsed = createProviderServiceBodySchema.safeParse({
        ...base,
        ...forbidden,
      });
      expect(parsed.success).toBe(false);
    }

    expect(createProviderServiceBodySchema.safeParse(base).success).toBe(true);
  });
});
