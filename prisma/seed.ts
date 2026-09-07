import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import {
  AUTHORIZATION_PERMISSIONS,
  AUTHORIZATION_ROLES,
  PRIVILEGED_ACTION_REASONS,
  ROLE_PERMISSION_MAP,
} from "../src/modules/authentication/domain/authorization.catalog.js";
import {
  EGYPT_HOUSEKEEPING_SEED,
  assertCategoryActivationContent,
  assertServiceActivationPolicy,
  assertServiceConfigurationGraph,
  decideCatalogSeedRowAction,
} from "../src/modules/catalog/catalog.policy.js";
import type { CatalogLocaleCode } from "../src/modules/catalog/catalog.policy.js";

/**
 * Seed the R1-P03 authorization definitions only: roles, permissions, the
 * role-permission map, and privileged-action reasons.
 *
 * This never creates a user-role grant, a user, or a staff bootstrap. Production
 * grants happen only through the internal role-management contract.
 *
 * Every definition upserts by its stable `code` (or role/permission pair) so a
 * second seed restores drifted `name` / `operation` / `isActive` without
 * creating duplicates. Privileged reasons also clear conflicting operation
 * holders inside a transaction with bounded P2002/P2034 retry.
 */
async function seedAuthorizationDefinitions(
  prisma: PrismaClient,
  options?: Readonly<{ skipCatalogAuth?: boolean }>,
): Promise<void> {
  const permissions = options?.skipCatalogAuth === true
    ? AUTHORIZATION_PERMISSIONS.filter(
        (permission) => !permission.code.startsWith("catalog."),
      )
    : AUTHORIZATION_PERMISSIONS;
  const reasons = options?.skipCatalogAuth === true
    ? PRIVILEGED_ACTION_REASONS.filter(
        (reason) => reason.operation !== "CATALOG_MANAGEMENT_WRITE",
      )
    : PRIVILEGED_ACTION_REASONS;
  const rolePermissionMap = options?.skipCatalogAuth === true
    ? Object.fromEntries(
        Object.entries(ROLE_PERMISSION_MAP).map(([roleCode, permissionCodes]) => [
          roleCode,
          permissionCodes.filter((permissionCode) => !permissionCode.startsWith("catalog.")),
        ]),
      )
    : ROLE_PERMISSION_MAP;

  for (const role of AUTHORIZATION_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: { code: role.code, name: role.name },
      update: { name: role.name }
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: { code: permission.code, name: permission.name },
      update: { name: permission.name }
    });
  }

  // Privileged reasons use @@unique(code) and @@unique(operation). Restore is
  // transactional: clear any other row holding a catalog operation, then upsert
  // by code. Bounded retry covers pooler races (P2002) and serialization
  // failures (P2034) without creating duplicates or touching unrelated rows.
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$transaction(async (transaction) => {
        for (const reason of reasons) {
          await transaction.privilegedActionReason.deleteMany({
            where: {
              operation: reason.operation,
              NOT: { code: reason.code },
            },
          });
          await transaction.privilegedActionReason.upsert({
            where: { code: reason.code },
            create: {
              code: reason.code,
              name: reason.name,
              operation: reason.operation,
              isActive: reason.isActive,
            },
            update: {
              name: reason.name,
              operation: reason.operation,
              isActive: reason.isActive,
            },
          });
        }
      }, { maxWait: 60_000, timeout: 60_000 });
      break;
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034") &&
        attempt < maxAttempts;
      if (!retryable) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }

  const [storedRoles, storedPermissions] = await Promise.all([
    prisma.role.findMany({ select: { id: true, code: true } }),
    prisma.permission.findMany({ select: { id: true, code: true } })
  ]);
  const roleIdsByCode = new Map(
    storedRoles.map((role) => [role.code, role.id])
  );
  const permissionIdsByCode = new Map(
    storedPermissions.map((permission) => [permission.code, permission.id])
  );

  for (const [roleCode, permissionCodes] of Object.entries(
    rolePermissionMap
  )) {
    const roleId = roleIdsByCode.get(roleCode);
    if (roleId === undefined) {
      throw new Error(`Seed is missing role ${roleCode}`);
    }
    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIdsByCode.get(permissionCode);
      if (permissionId === undefined) {
        throw new Error(`Seed is missing permission ${permissionCode}`);
      }
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId }
        },
        create: { roleId, permissionId },
        update: {}
      });
    }
  }
}

/**
 * Seed only owner-approved stable R1-P06 type definitions. Country-scoped
 * operators, banks, payout policy, keys, and document-policy publication are
 * deliberately excluded because they require a reviewed human manifest or
 * explicit Staff bootstrap workflow.
 */
async function seedR1P06StableTypes(prisma: PrismaClient): Promise<void> {
  for (const definition of [
    {
      code: "COMMERCIAL_REGISTRATION",
      displayNameEn: "Commercial registration",
      displayNameAr: "السجل التجاري",
      descriptionEn: "Registered-company commercial registration evidence.",
      descriptionAr: "مستند السجل التجاري للشركة المسجلة.",
    },
    {
      code: "TAX_REGISTRATION",
      displayNameEn: "Tax registration",
      displayNameAr: "التسجيل الضريبي",
      descriptionEn: "Registered-company tax registration evidence.",
      descriptionAr: "مستند التسجيل الضريبي للشركة المسجلة.",
    },
  ] as const) {
    await prisma.verificationDocumentType.upsert({
      where: { code: definition.code },
      create: { ...definition, isActive: true, version: 1 },
      update: {
        displayNameEn: definition.displayNameEn,
        displayNameAr: definition.displayNameAr,
        descriptionEn: definition.descriptionEn,
        descriptionAr: definition.descriptionAr,
        isActive: true,
      },
    });
  }

  for (const definition of [
    {
      code: "MOBILE_WALLET" as const,
      labelEn: "Mobile Wallet",
      labelAr: "محفظة هاتف محمول",
      descriptionEn: "External mobile-wallet payout destination.",
      descriptionAr: "وجهة دفع خارجية لمحفظة هاتف محمول.",
    },
    {
      code: "BANK_ACCOUNT" as const,
      labelEn: "Bank Account",
      labelAr: "حساب بنكي",
      descriptionEn: "External IBAN-first bank-account payout destination.",
      descriptionAr: "وجهة دفع خارجية لحساب بنكي باستخدام رقم IBAN.",
    },
  ] as const) {
    await prisma.payoutDestinationType.upsert({
      where: { code: definition.code },
      create: { ...definition, isActive: true, version: 1 },
      update: {
        labelEn: definition.labelEn,
        labelAr: definition.labelAr,
        descriptionEn: definition.descriptionEn,
        descriptionAr: definition.descriptionAr,
        isActive: true,
      },
    });
  }
}

export type SeedCatalogCountry = {
  readonly id: string;
  readonly code: string;
};

type CatalogSeedTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use"
>;

/**
 * @desc Choose a seed display order that preserves empty-baseline positions.
 * @explanation When a scope already has owner-managed rows, append the next
 * free position instead of colliding with existing unique display-order keys.
 */
export function resolveSeedDisplayOrder(
  existingOrders: readonly number[],
  seedDisplayOrder: number,
): number {
  if (existingOrders.length === 0) {
    return seedDisplayOrder;
  }
  return Math.max(...existingOrders) + 1;
}

/**
 * @desc Validate the DEC-044 Egypt housekeeping seed graph before persistence.
 * @explanation Seed writes must fail closed with the same Catalog policies used
 * by protected management instead of inventing a parallel validation path.
 */
export function validateEgyptHousekeepingSeedConfiguration(): void {
  const seed = EGYPT_HOUSEKEEPING_SEED;

  assertCategoryActivationContent({
    isActive: seed.category.isActive,
    nameAr: seed.category.nameAr,
    nameEn: seed.category.nameEn,
    descriptionAr: seed.category.descriptionAr,
    descriptionEn: seed.category.descriptionEn,
  });

  const { priceUnits, fields } = assertServiceConfigurationGraph({
    priceUnits: seed.priceUnits.map((unit) => ({
      code: unit.code,
      labelAr: unit.labelAr,
      labelEn: unit.labelEn,
      isActive: unit.isActive,
    })),
    fields: seed.fields.map((field) => ({
      code: field.code,
      kind: field.kind,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      helpTextAr: null,
      helpTextEn: null,
      isRequired: field.isRequired,
      isActive: field.isActive,
      minLength: field.minLength,
      maxLength: field.maxLength,
      numberMode: field.numberMode,
      minValue: field.minValue,
      maxValue: field.maxValue,
      minSelections: null,
      maxSelections: null,
      options: [],
    })),
  });

  assertServiceActivationPolicy({
    action: "ACTIVATE",
    categoryIsActive: seed.category.isActive,
    translations: [
      {
        locale: "AR",
        name: seed.service.nameAr,
        description: seed.service.descriptionAr,
      },
      {
        locale: "EN",
        name: seed.service.nameEn,
        description: seed.service.descriptionEn,
      },
    ],
    priceUnits,
    fields: fields.map((field) => ({
      code: field.code,
      isActive: field.isActive,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      options: [],
    })),
  });
}

async function seedCategoryRow(
  tx: CatalogSeedTransactionClient,
): Promise<{ readonly id: string; readonly code: string }> {
  const seed = EGYPT_HOUSEKEEPING_SEED.category;
  const existing = await tx.serviceCategory.findUnique({
    where: { code: seed.code },
  });

  const rowAction = decideCatalogSeedRowAction({
    stableCode: seed.code,
    existing:
      existing === null
        ? null
        : {
            code: existing.code,
            isActive: existing.isActive,
            version: existing.version,
          },
  });

  if (rowAction === "PRESERVE") {
    if (existing === null) {
      throw new Error(`Seed preserve decision missing existing category ${seed.code}`);
    }
    await tx.serviceCategory.update({
      where: { id: existing.id },
      data: {},
    });
    return existing;
  }

  const scopeOrders = (
    await tx.serviceCategory.findMany({ select: { displayOrder: true } })
  ).map((row) => row.displayOrder);
  const displayOrder = resolveSeedDisplayOrder(scopeOrders, seed.displayOrder);

  return tx.serviceCategory.create({
    data: {
      code: seed.code,
      nameAr: seed.nameAr,
      nameEn: seed.nameEn,
      descriptionAr: seed.descriptionAr,
      descriptionEn: seed.descriptionEn,
      displayOrder,
      isActive: seed.isActive,
      version: 1,
    },
  });
}

async function seedServiceRow(
  tx: CatalogSeedTransactionClient,
  categoryId: string,
): Promise<{ readonly id: string; readonly code: string }> {
  const seed = EGYPT_HOUSEKEEPING_SEED.service;
  const existing = await tx.service.findUnique({
    where: { code: seed.code },
  });

  const rowAction = decideCatalogSeedRowAction({
    stableCode: seed.code,
    existing:
      existing === null
        ? null
        : {
            code: existing.code,
            isActive: existing.isActive,
            version: existing.version,
          },
  });

  if (rowAction === "PRESERVE") {
    if (existing === null) {
      throw new Error(`Seed preserve decision missing existing service ${seed.code}`);
    }
    await tx.service.update({
      where: { id: existing.id },
      data: {},
    });
    return existing;
  }

  const scopeOrders = (
    await tx.service.findMany({
      where: { categoryId },
      select: { displayOrder: true },
    })
  ).map((row) => row.displayOrder);
  const displayOrder = resolveSeedDisplayOrder(scopeOrders, seed.displayOrder);

  return tx.service.create({
    data: {
      categoryId,
      code: seed.code,
      displayOrder,
      isActive: seed.isActive,
      version: 1,
    },
  });
}

async function seedServiceTranslations(
  tx: CatalogSeedTransactionClient,
  serviceId: string,
): Promise<void> {
  const seed = EGYPT_HOUSEKEEPING_SEED.service;
  const translations: readonly {
    readonly locale: CatalogLocaleCode;
    readonly name: string;
    readonly description: string;
  }[] = [
    {
      locale: "AR",
      name: seed.nameAr,
      description: seed.descriptionAr,
    },
    {
      locale: "EN",
      name: seed.nameEn,
      description: seed.descriptionEn,
    },
  ];

  for (const translation of translations) {
    const existing = await tx.serviceTranslation.findUnique({
      where: {
        serviceId_locale: {
          serviceId,
          locale: translation.locale,
        },
      },
    });

    if (existing === null) {
      await tx.serviceTranslation.create({
        data: {
          serviceId,
          locale: translation.locale,
          name: translation.name,
          description: translation.description,
        },
      });
      continue;
    }

    await tx.serviceTranslation.update({
      where: { id: existing.id },
      data: {},
    });
  }
}

async function seedPriceUnitRow(
  tx: CatalogSeedTransactionClient,
  serviceId: string,
  unit: (typeof EGYPT_HOUSEKEEPING_SEED.priceUnits)[number],
): Promise<void> {
  const existing = await tx.servicePriceUnit.findUnique({
    where: {
      serviceId_code: {
        serviceId,
        code: unit.code,
      },
    },
  });

  if (existing !== null) {
    await tx.servicePriceUnit.update({
      where: { id: existing.id },
      data: {},
    });
    return;
  }

  const scopeOrders = (
    await tx.servicePriceUnit.findMany({
      where: { serviceId },
      select: { displayOrder: true },
    })
  ).map((row) => row.displayOrder);
  const displayOrder = resolveSeedDisplayOrder(scopeOrders, unit.displayOrder);

  await tx.servicePriceUnit.create({
    data: {
      serviceId,
      code: unit.code,
      labelAr: unit.labelAr,
      labelEn: unit.labelEn,
      displayOrder,
      isActive: unit.isActive,
    },
  });
}

async function seedFieldRow(
  tx: CatalogSeedTransactionClient,
  serviceId: string,
  field: (typeof EGYPT_HOUSEKEEPING_SEED.fields)[number],
): Promise<void> {
  const existing = await tx.serviceField.findUnique({
    where: {
      serviceId_code: {
        serviceId,
        code: field.code,
      },
    },
  });

  if (existing !== null) {
    await tx.serviceField.update({
      where: { id: existing.id },
      data: {},
    });
    return;
  }

  const scopeOrders = (
    await tx.serviceField.findMany({
      where: { serviceId },
      select: { displayOrder: true },
    })
  ).map((row) => row.displayOrder);
  const displayOrder = resolveSeedDisplayOrder(scopeOrders, field.displayOrder);

  await tx.serviceField.create({
    data: {
      serviceId,
      code: field.code,
      kind: field.kind,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      helpTextAr: null,
      helpTextEn: null,
      isRequired: field.isRequired,
      isActive: field.isActive,
      minLength: field.minLength,
      maxLength: field.maxLength,
      numberMode: field.numberMode,
      minValue:
        field.minValue === null ? null : new Prisma.Decimal(field.minValue),
      maxValue:
        field.maxValue === null ? null : new Prisma.Decimal(field.maxValue),
      minSelections: null,
      maxSelections: null,
      displayOrder,
    },
  });
}

async function seedAvailabilityRow(
  tx: CatalogSeedTransactionClient,
  serviceId: string,
  countryId: string,
): Promise<void> {
  const seed = EGYPT_HOUSEKEEPING_SEED.availability;
  const existing = await tx.serviceCountryAvailability.findUnique({
    where: {
      serviceId_countryId: {
        serviceId,
        countryId,
      },
    },
  });

  if (existing !== null) {
    await tx.serviceCountryAvailability.update({
      where: { id: existing.id },
      data: {},
    });
    return;
  }

  await tx.serviceCountryAvailability.create({
    data: {
      serviceId,
      countryId,
      isAvailable: seed.isAvailable,
    },
  });
}

/**
 * @desc Create-if-missing DEC-044 Egypt housekeeping Catalog rows in one transaction.
 * @explanation Existing stable identities keep empty update branches so owner-managed
 * lifecycle, localization, ordering, and versions are never rewritten by seed.
 */
export async function seedR1P08Catalog(
  prisma: PrismaClient,
  country: SeedCatalogCountry,
): Promise<void> {
  validateEgyptHousekeepingSeedConfiguration();

  if (country.code !== EGYPT_HOUSEKEEPING_SEED.availability.countryCode) {
    throw new Error(
      `Catalog seed requires authoritative country ${EGYPT_HOUSEKEEPING_SEED.availability.countryCode}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const category = await seedCategoryRow(tx);
    const service = await seedServiceRow(tx, category.id);
    await seedServiceTranslations(tx, service.id);

    for (const unit of EGYPT_HOUSEKEEPING_SEED.priceUnits) {
      await seedPriceUnitRow(tx, service.id, unit);
    }

    for (const field of EGYPT_HOUSEKEEPING_SEED.fields) {
      await seedFieldRow(tx, service.id, field);
    }

    await seedAvailabilityRow(tx, service.id, country.id);
  }, { timeout: 60_000 });
}

/**
 * Seed R1-P01 reference data and R1-P03 authorization definitions. Every write
 * uses its approved natural key so repeated runs stay idempotent.
 *
 * When a Prisma client is provided (test lifecycle), reuse it and do not
 * disconnect. Standalone CLI seed opens a dedicated max-1 pool so it cannot
 * exhaust shared Neon connection budgets during Vitest coverage runs.
 */
export async function seed(
  existingClient?: PrismaClient,
  options?: Readonly<{ skipCatalogSeed?: boolean; skipCatalogAuth?: boolean }>,
): Promise<void> {
  let prisma = existingClient;
  let ownsClient = false;

  if (prisma === undefined) {
    const connectionString = process.env["DATABASE_URL"];
    if (connectionString === undefined || connectionString.length === 0) {
      throw new Error("DATABASE_URL is required to run the seed");
    }

    const pool = new pg.Pool({
      connectionString,
      max: 1,
      allowExitOnIdle: true,
    });
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });
    ownsClient = true;
  }

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

    await seedR1P06StableTypes(prisma);

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
    await prisma.appConfig.upsert({
      where: { key: "providers.service_pricing_policy" },
      create: {
        key: "providers.service_pricing_policy",
        value: Prisma.JsonNull,
        valueKind: "OBJECT",
        resolutionPolicy: "COUNTRY_REQUIRED",
        description: "Country-required provider service pricing policy metadata"
      },
      update: {
        value: Prisma.JsonNull,
        valueKind: "OBJECT",
        resolutionPolicy: "COUNTRY_REQUIRED"
      }
    });

    for (const config of [
      { key: 'auth.signin_policy', value: { maxFailures: 5, windowSeconds: 900, lockSeconds: 900 } },
      { key: 'auth.verification_policy', value: { ttlSeconds: 600, maxAttempts: 5, resendSeconds: 60 } },
      { key: 'auth.recovery_policy', value: { ttlSeconds: 1800, maxAttempts: 5 } },
      { key: 'auth.endpoint_limits', value: { signupPer15Minutes: 5, loginPer15Minutes: 20 } }
    ] as const) {
      await prisma.appConfig.upsert({
        where: { key: config.key },
        create: { key: config.key, value: config.value, valueKind: 'OBJECT', resolutionPolicy: config.key === 'auth.verification_policy' || config.key === 'auth.recovery_policy' ? 'COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK' : 'GLOBAL_ONLY', description: 'R1-P02 non-secret authentication policy' },
        update: { value: config.value, valueKind: 'OBJECT', resolutionPolicy: config.key === 'auth.verification_policy' || config.key === 'auth.recovery_policy' ? 'COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK' : 'GLOBAL_ONLY' }
      });
    }

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

    await seedAuthorizationDefinitions(prisma, {
      skipCatalogAuth: options?.skipCatalogAuth === true,
    });
    if (options?.skipCatalogSeed !== true) {
      await seedR1P08Catalog(prisma, country);
    }
  } finally {
    if (ownsClient) {
      await prisma.$disconnect();
    }
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
