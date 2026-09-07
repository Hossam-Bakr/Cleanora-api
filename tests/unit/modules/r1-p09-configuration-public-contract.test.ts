import { readFileSync } from "node:fs";
import { join } from "node:path";


vi.mock("#database/prisma", () => ({
  getPrismaClient: () => ({
    currency: {},
    country: {},
    appConfig: {},
    countryConfig: {},
  }),
}));

import {
  CONFIG_KEY_CATALOG,
  getConfigKeyDefinition,
} from "../../../src/modules/configuration/config-key.catalog.js";
import type { ConfigurationRepositories } from "../../../src/modules/configuration/configuration.repository.js";
import type {
  ProviderServicePricingPolicy,
  ProviderServicePricingPolicyReader,
  TransactionalProviderServicePricingPolicyReaderFactory,
} from "../../../src/modules/configuration/configuration.public.js";
import {
  convertCanonicalDecimalToMinorUnitDigits,
  readProviderServicePricingPolicyWith,
} from "../../../src/modules/configuration/configuration.service.js";
import {
  buildServicePricingPolicyValue,
  R1_P09_IDS,
  R1_P09_SENTINELS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

const POLICY_KEY = "providers.service_pricing_policy";

function createPricingPolicyRepositories(options?: {
  readonly countryActive?: boolean;
  readonly currencyActive?: boolean;
  readonly countryConfigValue?: unknown;
  readonly missingCountryConfig?: boolean;
  readonly missingAppConfig?: boolean;
  readonly decimalPlaces?: number;
}): ConfigurationRepositories {
  const countryActive = options?.countryActive ?? true;
  const currencyActive = options?.currencyActive ?? true;
  const decimalPlaces =
    options?.decimalPlaces ?? R1_P09_SENTINELS.currencyDecimalPlaces;

  return {
    country: {
      findByCode: async (code) =>
        code === R1_P09_IDS.countryCode && countryActive
          ? {
              id: R1_P09_IDS.countryId,
              code: R1_P09_IDS.countryCode,
              nameEn: "Synthetic Egypt",
              nameAr: "مصر تجريبية",
              defaultCurrencyCode: R1_P09_IDS.currencyCode,
              defaultLocale: "ar-EG",
              supportedLocales: ["ar-EG", "en-EG"],
              isActive: true,
            }
          : code === R1_P09_IDS.countryCode && !countryActive
            ? {
                id: R1_P09_IDS.countryId,
                code: R1_P09_IDS.countryCode,
                nameEn: "Inactive",
                nameAr: "غير نشط",
                defaultCurrencyCode: R1_P09_IDS.currencyCode,
                defaultLocale: "ar-EG",
                supportedLocales: ["ar-EG"],
                isActive: false,
              }
            : undefined,
      findIdByCode: async (code) =>
        code === R1_P09_IDS.countryCode ? R1_P09_IDS.countryId : undefined,
    },
    currency: {
      findByCode: async (code) =>
        code === R1_P09_IDS.currencyCode
          ? {
              id: R1_P09_IDS.currencyId,
              code: R1_P09_IDS.currencyCode,
              nameEn: "Synthetic Pound",
              nameAr: "جنيه تجريبي",
              decimalPlaces,
              isActive: currencyActive,
            }
          : undefined,
    },
    appConfig: {
      findByKey: async (key) =>
        options?.missingAppConfig === true || key !== POLICY_KEY
          ? undefined
          : {
              key: POLICY_KEY,
              value: null,
              valueKind: "OBJECT",
              resolutionPolicy: "COUNTRY_REQUIRED",
            },
    },
    countryConfig: {
      existsByKey: async () => true,
      findByCountryIdAndKey: async (_countryId, key) => {
        if (options?.missingCountryConfig === true || key !== POLICY_KEY) {
          return undefined;
        }
        return {
          key: POLICY_KEY,
          value:
            options?.countryConfigValue ??
            buildServicePricingPolicyValue({ approvalRequired: true }),
          valueKind: "OBJECT",
        };
      },
    },
  };
}

describe("R1-P09 configuration public contract (T006)", () => {
  let createProviderServicePricingPolicyReader: () => ProviderServicePricingPolicyReader;
  let createTransactionalProviderServicePricingPolicyReader: TransactionalProviderServicePricingPolicyReaderFactory;

  beforeAll(async () => {
    const configurationPublic = await import(
      "../../../src/modules/configuration/configuration.public.js"
    );
    createProviderServicePricingPolicyReader =
      configurationPublic.createProviderServicePricingPolicyReader;
    createTransactionalProviderServicePricingPolicyReader =
      configurationPublic.createTransactionalProviderServicePricingPolicyReader;
  });

  it("registers providers.service_pricing_policy as COUNTRY_REQUIRED OBJECT with approvalRequired + maximumPrice", () => {
    const definition = CONFIG_KEY_CATALOG[POLICY_KEY];
    expect(definition).toBeDefined();
    expect(definition.resolutionPolicy).toBe("COUNTRY_REQUIRED");
    expect(definition.valueKind).toBe("OBJECT");
    expect(getConfigKeyDefinition(POLICY_KEY)).toEqual(definition);

    const valid = definition.valueSchema.safeParse(
      buildServicePricingPolicyValue({ approvalRequired: true }),
    );
    expect(valid.success).toBe(true);

    const invalidZero = definition.valueSchema.safeParse({
      approvalRequired: false,
      maximumPrice: "0",
    });
    expect(invalidZero.success).toBe(false);

    const invalidLeadingZero = definition.valueSchema.safeParse({
      approvalRequired: false,
      maximumPrice: "01.50",
    });
    expect(invalidLeadingZero.success).toBe(false);

    const invalidExtraKey = definition.valueSchema.safeParse({
      approvalRequired: false,
      maximumPrice: "10.00",
      invented: true,
    });
    expect(invalidExtraKey.success).toBe(false);
  });

  it("converts canonical maximumPrice to minor-unit digits without inventing scale", () => {
    expect(
      convertCanonicalDecimalToMinorUnitDigits(
        R1_P09_SENTINELS.maximumPrice,
        R1_P09_SENTINELS.currencyDecimalPlaces,
      ),
    ).toBe("999999");
    expect(convertCanonicalDecimalToMinorUnitDigits("12.3", 2)).toBe("1230");
    expect(convertCanonicalDecimalToMinorUnitDigits("12.345", 2)).toBeNull();
    expect(convertCanonicalDecimalToMinorUnitDigits("0", 2)).toBeNull();
    expect(convertCanonicalDecimalToMinorUnitDigits("1.00", -1)).toBeNull();
  });

  it("reads AVAILABLE policy with active default currency id/code/scale via repository helper", async () => {
    const result = await readProviderServicePricingPolicyWith(
      createPricingPolicyRepositories(),
      R1_P09_IDS.countryCode,
    );

    expect(result).toEqual({
      status: "AVAILABLE",
      value: {
        countryId: R1_P09_IDS.countryId,
        countryCode: R1_P09_IDS.countryCode,
        currency: {
          id: R1_P09_IDS.currencyId,
          code: R1_P09_IDS.currencyCode,
          decimalPlaces: R1_P09_SENTINELS.currencyDecimalPlaces,
        },
        approvalRequired: true,
        maximumPrice: R1_P09_SENTINELS.maximumPrice,
      } satisfies ProviderServicePricingPolicy,
    });
  });

  it("fails closed for missing country, currency, policy, or invalid maximum", async () => {
    await expect(
      readProviderServicePricingPolicyWith(
        createPricingPolicyRepositories({ countryActive: false }),
        R1_P09_IDS.countryCode,
      ),
    ).resolves.toEqual({ status: "UNAVAILABLE", code: "COUNTRY_UNAVAILABLE" });

    await expect(
      readProviderServicePricingPolicyWith(
        createPricingPolicyRepositories({ currencyActive: false }),
        R1_P09_IDS.countryCode,
      ),
    ).resolves.toEqual({ status: "UNAVAILABLE", code: "CURRENCY_UNAVAILABLE" });

    await expect(
      readProviderServicePricingPolicyWith(
        createPricingPolicyRepositories({ missingCountryConfig: true }),
        R1_P09_IDS.countryCode,
      ),
    ).resolves.toEqual({
      status: "UNAVAILABLE",
      code: "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE",
    });

    await expect(
      readProviderServicePricingPolicyWith(
        createPricingPolicyRepositories({
          countryConfigValue: {
            approvalRequired: false,
            maximumPrice: "12.345",
          },
          decimalPlaces: 2,
        }),
        R1_P09_IDS.countryCode,
      ),
    ).resolves.toEqual({
      status: "UNAVAILABLE",
      code: "PROVIDER_SERVICE_PRICING_POLICY_UNAVAILABLE",
    });
  });

  it("exports createProviderServicePricingPolicyReader and transactional factory types", () => {
    expect(typeof createProviderServicePricingPolicyReader).toBe("function");
    expect(typeof createTransactionalProviderServicePricingPolicyReader).toBe(
      "function",
    );

    const reader: ProviderServicePricingPolicyReader =
      createProviderServicePricingPolicyReader();
    expect(typeof reader.readForCountry).toBe("function");

    const factory: TransactionalProviderServicePricingPolicyReaderFactory =
      createTransactionalProviderServicePricingPolicyReader;
    expect(typeof factory).toBe("function");
  });

  it("does not invent production country pricing-policy values in seed", () => {
    const seedSource = readFileSync(
      join(process.cwd(), "prisma", "seed.ts"),
      "utf8",
    );
    expect(seedSource).toContain(`key: "${POLICY_KEY}"`);
    expect(seedSource).toMatch(
      /providers\.service_pricing_policy[\s\S]*?value:\s*Prisma\.JsonNull/u,
    );
    expect(seedSource).not.toMatch(
      /countryId_key:[\s\S]*providers\.service_pricing_policy[\s\S]*approvalRequired/u,
    );
    expect(seedSource).not.toMatch(
      /key:\s*"providers\.service_pricing_policy"[\s\S]*maximumPrice\s*:/u,
    );
  });
});
