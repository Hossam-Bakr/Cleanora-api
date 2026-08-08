import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import {
  AUTHORIZATION_PERMISSIONS,
  AUTHORIZATION_ROLES,
  PRIVILEGED_ACTION_REASONS,
  ROLE_PERMISSION_MAP,
} from "../src/modules/authentication/domain/authorization.catalog.js";

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
  prisma: PrismaClient
): Promise<void> {
  for (const role of AUTHORIZATION_ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: { code: role.code, name: role.name },
      update: { name: role.name }
    });
  }

  for (const permission of AUTHORIZATION_PERMISSIONS) {
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
        for (const reason of PRIVILEGED_ACTION_REASONS) {
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
      });
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
    ROLE_PERMISSION_MAP
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
 * Seed R1-P01 reference data and R1-P03 authorization definitions. Every write
 * uses its approved natural key so repeated runs stay idempotent.
 *
 * When a Prisma client is provided (test lifecycle), reuse it and do not
 * disconnect. Standalone CLI seed opens a dedicated max-1 pool so it cannot
 * exhaust shared Neon connection budgets during Vitest coverage runs.
 */
export async function seed(existingClient?: PrismaClient): Promise<void> {
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

    await seedAuthorizationDefinitions(prisma);
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
