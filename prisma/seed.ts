import { createHash, randomBytes } from "node:crypto";

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
  // Skip catalog operations whose Postgres enum label is not yet applied
  // (populated R1-P09→P10 upgrade seeds against the pre-P10 enum).
  const availableOperations = await prisma.$queryRaw<
    Array<{ enumlabel: string }>
  >`
    SELECT e.enumlabel::text AS enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PrivilegedActionOperation'
      AND n.nspname = current_schema()
  `;
  const availableOperationSet = new Set(
    availableOperations.map((row) => row.enumlabel),
  );
  const applicableReasons = reasons.filter((reason) =>
    availableOperationSet.has(reason.operation),
  );

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$transaction(async (transaction) => {
        for (const reason of applicableReasons) {
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

async function countryConfigsHaveVersionColumn(
  prisma: PrismaClient,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'country_configs'
        AND column_name = 'version'
    ) AS "exists"
  `;
  return rows[0]?.exists === true;
}

/**
 * Upsert a CountryConfig row on both R1-P09 (no `version`) and R1-P10+ schemas.
 * Omitting `version` from SQL lets the R1-P10 DEFAULT apply when present.
 */
async function upsertCountryConfigCompatible(
  prisma: PrismaClient,
  row: Readonly<{
    countryId: string;
    key: string;
    value: Prisma.InputJsonValue;
    valueKind: "STRING" | "ARRAY" | "OBJECT" | "NUMBER";
  }>,
): Promise<void> {
  if (await countryConfigsHaveVersionColumn(prisma)) {
    await prisma.countryConfig.upsert({
      where: {
        countryId_key: { countryId: row.countryId, key: row.key },
      },
      create: {
        countryId: row.countryId,
        key: row.key,
        value: row.value,
        valueKind: row.valueKind,
      },
      update: {
        value: row.value,
        valueKind: row.valueKind,
      },
    });
    return;
  }

  const id = `seed_cc_${randomBytes(12).toString("hex")}`;
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "country_configs" (
      "id", "country_id", "key", "value", "value_kind", "created_at", "updated_at"
    ) VALUES (
      $1, $2, $3, $4::jsonb, $5::"ConfigValueKind", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("country_id", "key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "value_kind" = EXCLUDED."value_kind",
      "updated_at" = CURRENT_TIMESTAMP
    `,
    id,
    row.countryId,
    row.key,
    JSON.stringify(row.value),
    row.valueKind,
  );
}

/** Frozen R1-P11 V1 eligibility rule seed identity (DEC-082 / rule-version-contract). */
export const R1_P11_ELIGIBILITY_RULE_SEED = {
  id: "eligibility_rule_r1_v1_eg",
  versionLabel: "r1-v1",
  countryCode: "EG",
  effectiveFrom: new Date("2026-09-09T00:00:00.000Z"),
  schemaVersion: "eligibility.rules.v1",
  engineCompatibility: "eligibility-engine.r1.v1",
  createdByProvenance: "prisma.seed.r1_p11_eligibility_rule_r1_v1_eg",
  ruleOrder: [
    "CATALOG_APPLICABILITY",
    "PROVIDER_APPROVAL_VERIFICATION_LIVE",
    "OFFERING_PRICE_USABILITY",
    "TEXTUAL_COVERAGE",
    "PROVIDER_SCHEDULE_PAUSE",
    "COMPLETE_TEAM_VALIDITY_AVAILABILITY",
    "CREW_PREFERENCE",
    "CAPACITY_AFTER_CREW_FILTER",
    "PERFORMANCE_GATE",
  ],
  parameters: {
    maxProvidersPerEvaluation: 500,
    maxTeamResultsPerEvaluation: 5000,
    maxIntervalHours: 24,
    minRequiredTeamUnits: 1,
    maxRequiredTeamUnits: 50,
    crewPreferences: ["all_male", "all_female", "any"],
    performanceGate: {
      enabled: false,
      metricKey: null,
      minimumThreshold: null,
      minimumSampleCount: null,
      maxEvidenceAgeSeconds: null,
    },
  },
} as const;

/**
 * @desc Canonical JSON for Eligibility checksums (DEC-081): sorted object keys,
 * defined array order, no undefined, UTC timestamps as ISO-8601 with Z.
 */
function eligibilityCanonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("Eligibility canonical JSON forbids undefined");
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => eligibilityCanonicalJson(entry)).join(",")}]`;
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${eligibilityCanonicalJson(entry)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * @desc SHA-256 hex of canonical JSON over schemaVersion, engineCompatibility,
 * ruleOrder, and parameters (DEC-082 checksum excludes provenance/id).
 */
export function computeR1P11EligibilityRuleContentChecksum(input: {
  readonly schemaVersion: string;
  readonly engineCompatibility: string;
  readonly ruleOrder: unknown;
  readonly parameters: unknown;
}): string {
  const payload = {
    schemaVersion: input.schemaVersion,
    engineCompatibility: input.engineCompatibility,
    ruleOrder: input.ruleOrder,
    parameters: input.parameters,
  };
  return createHash("sha256")
    .update(eligibilityCanonicalJson(payload), "utf8")
    .digest("hex");
}

function eligibilityJsonEquals(left: unknown, right: unknown): boolean {
  return eligibilityCanonicalJson(left) === eligibilityCanonicalJson(right);
}

/**
 * @desc Idempotent V1 Egypt eligibility rule-version seed (DEC-082).
 * @explanation Identical immutable fields → no-op; any drift → throw without
 * overwrite. Country is resolved by code EG.
 */
export async function seedR1P11EligibilityRuleVersion(
  prisma: PrismaClient,
): Promise<void> {
  const country = await prisma.country.findUnique({
    where: { code: R1_P11_ELIGIBILITY_RULE_SEED.countryCode },
    select: { id: true, code: true },
  });
  if (country === null) {
    throw new Error(
      `Eligibility rule seed requires country ${R1_P11_ELIGIBILITY_RULE_SEED.countryCode}`,
    );
  }

  const contentChecksum = computeR1P11EligibilityRuleContentChecksum({
    schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
    engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
    ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
    parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
  });

  const expected = {
    id: R1_P11_ELIGIBILITY_RULE_SEED.id,
    countryId: country.id,
    versionLabel: R1_P11_ELIGIBILITY_RULE_SEED.versionLabel,
    schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
    engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
    ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
    parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
    effectiveFrom: R1_P11_ELIGIBILITY_RULE_SEED.effectiveFrom,
    contentChecksum,
  };

  const existing = await prisma.eligibilityRuleVersion.findUnique({
    where: { id: expected.id },
  });

  if (existing !== null) {
    const driftFields: string[] = [];
    if (existing.countryId !== expected.countryId) driftFields.push("countryId");
    if (existing.versionLabel !== expected.versionLabel) {
      driftFields.push("versionLabel");
    }
    if (existing.schemaVersion !== expected.schemaVersion) {
      driftFields.push("schemaVersion");
    }
    if (existing.engineCompatibility !== expected.engineCompatibility) {
      driftFields.push("engineCompatibility");
    }
    if (!eligibilityJsonEquals(existing.ruleOrder, expected.ruleOrder)) {
      driftFields.push("ruleOrder");
    }
    if (!eligibilityJsonEquals(existing.parameters, expected.parameters)) {
      driftFields.push("parameters");
    }
    if (existing.effectiveFrom.getTime() !== expected.effectiveFrom.getTime()) {
      driftFields.push("effectiveFrom");
    }
    if (existing.contentChecksum !== expected.contentChecksum) {
      driftFields.push("contentChecksum");
    }
    if (driftFields.length > 0) {
      throw new Error(
        `Eligibility rule seed drift for ${expected.id}: immutable fields diverged (${driftFields.join(", ")}); refusing overwrite`,
      );
    }
    return;
  }

  await prisma.eligibilityRuleVersion.create({
    data: {
      id: expected.id,
      countryId: expected.countryId,
      versionLabel: expected.versionLabel,
      schemaVersion: expected.schemaVersion,
      engineCompatibility: expected.engineCompatibility,
      ruleOrder: expected.ruleOrder,
      parameters: expected.parameters,
      effectiveFrom: expected.effectiveFrom,
      contentChecksum: expected.contentChecksum,
      createdByProvenance: R1_P11_ELIGIBILITY_RULE_SEED.createdByProvenance,
    },
  });
}

/**
 * Seed R1-P01 reference data and R1-P03 authorization definitions. Every write
 * uses its approved natural key so repeated runs stay idempotent.
 *
 * When a Prisma client is provided (test lifecycle), reuse it and do not
 * disconnect. Standalone CLI seed opens a dedicated max-1 pool so it cannot
 * exhaust shared Neon connection budgets during Vitest coverage runs.
 */
const R1_P14_SYSTEM_ACCOUNT_TYPES = [
  "PLATFORM_CLEARING",
  "PLATFORM_REVENUE",
  "PROVIDER_PAYABLE",
  "CUSTOMER_DEPOSIT_LIABILITY",
  "COD_CLEARING",
  "PAYOUT_CLEARING",
  "REFUND_CLEARING",
  "ADJUSTMENT_CLEARING",
] as const;

/**
 * @desc Idempotent Egypt system ledger accounts (R1-P14). Safe when the
 * migration INSERT already ran against an existing country row.
 */
export async function seedR1P14EgyptLedgerAccounts(
  prisma: PrismaClient,
  country: { readonly id: string },
  currency: { readonly code: string; readonly decimalPlaces: number },
): Promise<void> {
  for (const accountType of R1_P14_SYSTEM_ACCOUNT_TYPES) {
    await prisma.ledgerAccount.upsert({
      where: {
        countryId_currencyCode_accountType: {
          countryId: country.id,
          currencyCode: currency.code,
          accountType,
        },
      },
      create: {
        id: `ldgacc_${country.id}_${accountType}`,
        countryId: country.id,
        currencyCode: currency.code,
        currencyDecimalPlaces: currency.decimalPlaces,
        accountType,
      },
      update: {},
    });
  }
}

const R1_P15_EGYPT_PAYMENT_METHODS = [
  {
    id: "paymthd_eg_paymob_card",
    provider: "PAYMOB" as const,
    methodKind: "CARD" as const,
    code: "PAYMOB_CARD",
    displayNameAr: "بطاقة",
    displayNameEn: "Card",
    enabled: true,
    sortOrder: 10,
  },
  {
    id: "paymthd_eg_paymob_wallet",
    provider: "PAYMOB" as const,
    methodKind: "WALLET" as const,
    code: "PAYMOB_WALLET",
    displayNameAr: "محفظة",
    displayNameEn: "Wallet",
    enabled: true,
    sortOrder: 20,
  },
  {
    id: "paymthd_eg_other_disabled",
    provider: "OTHER_DISABLED" as const,
    methodKind: "OTHER" as const,
    code: "OTHER_DISABLED",
    displayNameAr: "طريقة أخرى (معطلة)",
    displayNameEn: "Other (disabled)",
    enabled: false,
    sortOrder: 90,
  },
] as const;

/**
 * @desc Idempotent Egypt payment methods (R1-P15). Migration INSERT is a no-op
 * until the Egypt country row exists; seed applies after country creation.
 */
export async function seedR1P15EgyptPaymentMethods(
  prisma: PrismaClient,
  country: { readonly id: string },
): Promise<void> {
  for (const method of R1_P15_EGYPT_PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: {
        countryId_code: {
          countryId: country.id,
          code: method.code,
        },
      },
      create: {
        id: method.id,
        countryId: country.id,
        provider: method.provider,
        methodKind: method.methodKind,
        code: method.code,
        displayNameAr: method.displayNameAr,
        displayNameEn: method.displayNameEn,
        enabled: method.enabled,
        sortOrder: method.sortOrder,
      },
      update: {
        provider: method.provider,
        methodKind: method.methodKind,
        displayNameAr: method.displayNameAr,
        displayNameEn: method.displayNameEn,
        enabled: method.enabled,
        sortOrder: method.sortOrder,
      },
    });
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

    // R1-P10 (DEC-053): platform.default_timezone evolves from GLOBAL_ONLY to
    // COUNTRY_REQUIRED. The historical global value is preserved for record
    // but resolution now requires country context via CountryConfig below.
    await prisma.appConfig.upsert({
      where: { key: "platform.default_timezone" },
      create: {
        key: "platform.default_timezone",
        value: "Africa/Cairo",
        valueKind: "STRING",
        resolutionPolicy: "COUNTRY_REQUIRED",
        description: "Country-required IANA operating timezone"
      },
      update: {
        valueKind: "STRING",
        resolutionPolicy: "COUNTRY_REQUIRED",
        description: "Country-required IANA operating timezone"
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

    // CountryConfig upserts must stay compatible with a populated R1-P09→P10
    // upgrade fixture: the R1-P09 baseline schema lacks `country_configs.version`
    // (added only by the R1-P10 migration). Prefer the typed Prisma path when
    // the column exists; otherwise use column-agnostic SQL that omits version.
    await upsertCountryConfigCompatible(prisma, {
      countryId: country.id,
      key: "country.display_name",
      value: { en: "Egypt", ar: "مصر" },
      valueKind: "OBJECT",
    });
    await upsertCountryConfigCompatible(prisma, {
      countryId: country.id,
      key: "country.supported_locales",
      value: ["ar-EG", "en-EG"],
      valueKind: "ARRAY",
    });
    await upsertCountryConfigCompatible(prisma, {
      countryId: country.id,
      key: "country.currency_code",
      value: "EGP",
      valueKind: "STRING",
    });
    // R1-P10 (DEC-053): Egypt's country-required IANA operating timezone.
    await upsertCountryConfigCompatible(prisma, {
      countryId: country.id,
      key: "platform.default_timezone",
      value: "Africa/Cairo",
      valueKind: "STRING",
    });
    await prisma.appConfig.upsert({
      where: { key: "commercial.provider_response_hours" },
      create: {
        key: "commercial.provider_response_hours",
        value: 24,
        valueKind: "NUMBER",
        resolutionPolicy: "COUNTRY_REQUIRED",
        description:
          "Country-required hours the selected provider has to accept or reject a confirmed booking",
      },
      update: {
        value: 24,
        valueKind: "NUMBER",
        resolutionPolicy: "COUNTRY_REQUIRED",
      },
    });
    await upsertCountryConfigCompatible(prisma, {
      countryId: country.id,
      key: "commercial.provider_response_hours",
      value: 24,
      valueKind: "NUMBER",
    });

    await seedAuthorizationDefinitions(prisma, {
      skipCatalogAuth: options?.skipCatalogAuth === true,
    });
    if (options?.skipCatalogSeed !== true) {
      await seedR1P08Catalog(prisma, country);
    }

    // R1-P11: deterministic V1 eligibility rule bundle for Egypt. Skip when the
    // phase migration has not been applied yet (populated upgrade fixtures may
    // still run the shared seed against a pre-P11 schema).
    const eligibilityRuleTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'eligibility_rule_versions'
      ) AS "exists"
    `;
    if (eligibilityRuleTable[0]?.exists === true) {
      await seedR1P11EligibilityRuleVersion(prisma);
    }

    const ledgerAccountTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'ledger_accounts'
      ) AS "exists"
    `;
    if (ledgerAccountTable[0]?.exists === true) {
      await seedR1P14EgyptLedgerAccounts(prisma, country, currency);
    }

    const paymentMethodTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'payment_methods'
      ) AS "exists"
    `;
    if (paymentMethodTable[0]?.exists === true) {
      await seedR1P15EgyptPaymentMethods(prisma, country);
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
