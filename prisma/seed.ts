import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";

/**
 * Seed only R1-P01 reference data. Every write uses its approved natural key.
 */
export async function seed(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required to run the seed");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });

  try {
    const currency = await prisma.currency.upsert({
      where: { code: "EGP" },
      create: {
        code: "EGP",
        nameEn: "Egyptian Pound",
        nameAr: "جنيه مصري",
        decimalPlaces: 2,
        isActive: true
      },
      update: {
        nameEn: "Egyptian Pound",
        nameAr: "جنيه مصري",
        decimalPlaces: 2,
        isActive: true
      }
    });

    const country = await prisma.country.upsert({
      where: { code: "EG" },
      create: {
        code: "EG",
        nameEn: "Egypt",
        nameAr: "مصر",
        defaultCurrencyId: currency.id,
        defaultLocale: "ar-EG",
        supportedLocales: ["ar-EG", "en-EG"],
        isActive: true
      },
      update: {
        nameEn: "Egypt",
        nameAr: "مصر",
        defaultCurrencyId: currency.id,
        defaultLocale: "ar-EG",
        supportedLocales: ["ar-EG", "en-EG"],
        isActive: true
      }
    });

    await prisma.appConfig.upsert({
      where: { key: "platform.default_timezone" },
      create: {
        key: "platform.default_timezone",
        value: "Africa/Cairo",
        valueKind: "STRING",
        resolutionPolicy: "GLOBAL_ONLY",
        description: "Default platform timezone"
      },
      update: {
        value: "Africa/Cairo",
        valueKind: "STRING",
        resolutionPolicy: "GLOBAL_ONLY"
      }
    });
    await prisma.appConfig.upsert({
      where: { key: "country.display_name" },
      create: {
        key: "country.display_name",
        value: Prisma.JsonNull,
        valueKind: "OBJECT",
        resolutionPolicy: "COUNTRY_REQUIRED",
        description: "Localized country display name"
      },
      update: {
        value: Prisma.JsonNull,
        valueKind: "OBJECT",
        resolutionPolicy: "COUNTRY_REQUIRED"
      }
    });
    await prisma.appConfig.upsert({
      where: { key: "country.supported_locales" },
      create: {
        key: "country.supported_locales",
        value: ["en"],
        valueKind: "ARRAY",
        resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK",
        description: "Supported locales by country"
      },
      update: {
        value: ["en"],
        valueKind: "ARRAY",
        resolutionPolicy: "COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK"
      }
    });
    await prisma.appConfig.upsert({
      where: { key: "country.currency_code" },
      create: {
        key: "country.currency_code",
        value: Prisma.JsonNull,
        valueKind: "STRING",
        resolutionPolicy: "COUNTRY_REQUIRED",
        description: "Country default currency code"
      },
      update: {
        value: Prisma.JsonNull,
        valueKind: "STRING",
        resolutionPolicy: "COUNTRY_REQUIRED"
      }
    });

    await prisma.countryConfig.upsert({
      where: {
        countryId_key: { countryId: country.id, key: "country.display_name" }
      },
      create: {
        countryId: country.id,
        key: "country.display_name",
        value: { en: "Egypt", ar: "مصر" },
        valueKind: "OBJECT"
      },
      update: {
        value: { en: "Egypt", ar: "مصر" },
        valueKind: "OBJECT"
      }
    });
    await prisma.countryConfig.upsert({
      where: {
        countryId_key: { countryId: country.id, key: "country.supported_locales" }
      },
      create: {
        countryId: country.id,
        key: "country.supported_locales",
        value: ["ar-EG", "en-EG"],
        valueKind: "ARRAY"
      },
      update: { value: ["ar-EG", "en-EG"], valueKind: "ARRAY" }
    });
    await prisma.countryConfig.upsert({
      where: {
        countryId_key: { countryId: country.id, key: "country.currency_code" }
      },
      create: {
        countryId: country.id,
        key: "country.currency_code",
        value: "EGP",
        valueKind: "STRING"
      },
      update: { value: "EGP", valueKind: "STRING" }
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void seed().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        error: "SEED_FAILED",
        errorName: error instanceof Error ? error.name : "UnknownError"
      })}\n`
    );
    process.exitCode = 1;
  });
}
