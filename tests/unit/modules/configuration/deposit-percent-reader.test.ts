import { createDepositPercentReader } from "#modules/configuration/infrastructure/prisma-deposit-percent.reader";

describe("deposit percent reader", () => {
  it("returns canonical percent facts for an active country", async () => {
    const reader = createDepositPercentReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({
          id: "country-1",
          code: "EG",
          isActive: true,
          defaultCurrency: { code: "EGP", decimalPlaces: 2, isActive: true },
        }),
      },
      countryConfig: {
        findUnique: vi.fn().mockResolvedValue({
          valueKind: "NUMBER",
          value: 25,
        }),
      },
    });
    await expect(reader.readForCountryId("country-1")).resolves.toEqual({
      countryId: "country-1",
      countryCode: "EG",
      currencyCode: "EGP",
      decimalPlaces: 2,
      percentCanonical: "25",
    });
  });

  it("fails closed when the country config is missing", async () => {
    const reader = createDepositPercentReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({
          id: "country-1",
          code: "EG",
          isActive: true,
          defaultCurrency: { code: "EGP", decimalPlaces: 2, isActive: true },
        }),
      },
      countryConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(reader.readForCountryId("country-1")).resolves.toBeNull();
  });

  it("accepts canonical percent strings and rejects invalid values", async () => {
    const country = {
      findUnique: vi.fn().mockResolvedValue({
        id: "country-1",
        code: "EG",
        isActive: true,
        defaultCurrency: { code: "EGP", decimalPlaces: 2, isActive: true },
      }),
    };
    const stringReader = createDepositPercentReader({
      country,
      countryConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ valueKind: "NUMBER", value: "25.50" }),
      },
    });
    await expect(
      stringReader.readForCountryId("country-1"),
    ).resolves.toMatchObject({
      percentCanonical: "25.50",
    });
    const invalidReader = createDepositPercentReader({
      country,
      countryConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ valueKind: "NUMBER", value: "nope" }),
      },
    });
    await expect(
      invalidReader.readForCountryId("country-1"),
    ).resolves.toBeNull();
    const missingCountry = createDepositPercentReader({
      country: { findUnique: vi.fn().mockResolvedValue(null) },
      countryConfig: { findUnique: vi.fn() },
    });
    await expect(
      missingCountry.readForCountryId("missing"),
    ).resolves.toBeNull();
    const decimalReader = createDepositPercentReader({
      country,
      countryConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ valueKind: "NUMBER", value: 12.5 }),
      },
    });
    await expect(
      decimalReader.readForCountryId("country-1"),
    ).resolves.toMatchObject({
      percentCanonical: "12.5",
    });
    const inactive = createDepositPercentReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({
          id: "country-1",
          code: "EG",
          isActive: false,
          defaultCurrency: { code: "EGP", decimalPlaces: 2, isActive: true },
        }),
      },
      countryConfig: { findUnique: vi.fn() },
    });
    await expect(inactive.readForCountryId("country-1")).resolves.toBeNull();
    const wrongKind = createDepositPercentReader({
      country,
      countryConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ valueKind: "STRING", value: "25" }),
      },
    });
    await expect(wrongKind.readForCountryId("country-1")).resolves.toBeNull();
    const tooHigh = createDepositPercentReader({
      country,
      countryConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ valueKind: "NUMBER", value: "101" }),
      },
    });
    await expect(tooHigh.readForCountryId("country-1")).resolves.toBeNull();
  });

  it.each([0, 100, 12.34])(
    "accepts numeric percent %s when it has at most two decimals",
    async (configuredPercent) => {
      const reader = createDepositPercentReader({
        country: {
          findUnique: vi.fn().mockResolvedValue({
            id: "country-1",
            code: "EG",
            isActive: true,
            defaultCurrency: { code: "EGP", decimalPlaces: 2, isActive: true },
          }),
        },
        countryConfig: {
          findUnique: vi.fn().mockResolvedValue({
            valueKind: "NUMBER",
            value: configuredPercent,
          }),
        },
      });

      await expect(reader.readForCountryId("country-1")).resolves.toMatchObject(
        {
          percentCanonical: String(configuredPercent),
        },
      );
    },
  );

  it.each([12.345, 0.001, 1e-7])(
    "rejects numeric percent %s with excessive or exponent-form precision",
    async (configuredPercent) => {
      const reader = createDepositPercentReader({
        country: {
          findUnique: vi.fn().mockResolvedValue({
            id: "country-1",
            code: "EG",
            isActive: true,
            defaultCurrency: { code: "EGP", decimalPlaces: 2, isActive: true },
          }),
        },
        countryConfig: {
          findUnique: vi.fn().mockResolvedValue({
            valueKind: "NUMBER",
            value: configuredPercent,
          }),
        },
      });

      await expect(reader.readForCountryId("country-1")).resolves.toBeNull();
    },
  );
});
