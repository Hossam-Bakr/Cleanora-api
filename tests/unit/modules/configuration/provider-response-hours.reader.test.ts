import { createProviderResponseHoursReader } from "#modules/configuration/infrastructure/prisma-provider-response-hours.reader";

describe("provider response hours reader", () => {
  it("returns country-required hours for an active country", async () => {
    const reader = createProviderResponseHoursReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({ id: "eg", isActive: true }),
      },
      countryConfig: {
        findUnique: vi.fn().mockResolvedValue({
          valueKind: "NUMBER",
          value: 24,
        }),
      },
    });
    await expect(reader.readHoursForCountryId("eg")).resolves.toBe(24);
  });

  it("fail-closes when the country or hours config is missing", async () => {
    const missingCountry = createProviderResponseHoursReader({
      country: { findUnique: vi.fn().mockResolvedValue(null) },
      countryConfig: { findUnique: vi.fn() },
    });
    await expect(missingCountry.readHoursForCountryId("eg")).resolves.toBeNull();

    const missingConfig = createProviderResponseHoursReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({ id: "eg", isActive: true }),
      },
      countryConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(missingConfig.readHoursForCountryId("eg")).resolves.toBeNull();
  });

  it("accepts canonical hour strings and rejects out-of-range values", async () => {
    const country = {
      findUnique: vi.fn().mockResolvedValue({ id: "eg", isActive: true }),
    };
    const stringReader = createProviderResponseHoursReader({
      country,
      countryConfig: {
        findUnique: vi.fn().mockResolvedValue({ valueKind: "NUMBER", value: "24" }),
      },
    });
    await expect(stringReader.readHoursForCountryId("eg")).resolves.toBe(24);

    const invalid = createProviderResponseHoursReader({
      country,
      countryConfig: {
        findUnique: vi.fn().mockResolvedValue({ valueKind: "NUMBER", value: 0 }),
      },
    });
    await expect(invalid.readHoursForCountryId("eg")).resolves.toBeNull();

    const inactive = createProviderResponseHoursReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({ id: "eg", isActive: false }),
      },
      countryConfig: { findUnique: vi.fn() },
    });
    await expect(inactive.readHoursForCountryId("eg")).resolves.toBeNull();

    const wrongKind = createProviderResponseHoursReader({
      country: {
        findUnique: vi.fn().mockResolvedValue({ id: "eg", isActive: true }),
      },
      countryConfig: {
        findUnique: vi.fn().mockResolvedValue({ valueKind: "STRING", value: "24" }),
      },
    });
    await expect(wrongKind.readHoursForCountryId("eg")).resolves.toBeNull();
  });

  it("normalizes in-range hours and rejects invalid values", async () => {
    const country = {
      findUnique: vi.fn().mockResolvedValue({ id: "eg", isActive: true }),
    };
    const read = async (value: unknown) =>
      createProviderResponseHoursReader({
        country,
        countryConfig: {
          findUnique: vi.fn().mockResolvedValue({ valueKind: "NUMBER", value }),
        },
      }).readHoursForCountryId("eg");

    await expect(read(168)).resolves.toBe(168);
    await expect(read(169)).resolves.toBeNull();
    await expect(read(24.5)).resolves.toBeNull();
    await expect(read("168")).resolves.toBe(168);
    await expect(read("abc")).resolves.toBeNull();
    await expect(read({ hours: 24 })).resolves.toBeNull();
    await expect(read(1)).resolves.toBe(1);
    await expect(read("1")).resolves.toBe(1);
  });
});
