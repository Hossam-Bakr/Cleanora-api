import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import type { CatalogServiceConfigurationReplacementInput } from "../../../src/modules/catalog/catalog.repository.js";
import {
  cleanupCatalogTestRows,
  createConnectedMigrationProofCatalogClient,
  createLiveCatalogRepository,
  ensureR1P08CatalogSeeded,
  ensureR1P08CatalogDatabaseMigrated,
  hasExplicitR1P08CatalogDatabase,
  LIVE_CATALOG_TRANSACTION_OPTIONS,
  requireR1P08CatalogDatabaseUrl,
} from "../../helpers/r1-p08-catalog-live.js";
import {
  expectR1P07ConstraintRejection,
} from "../../../scripts/validate-clean-migration.js";

vi.setConfig({ testTimeout: 180_000 });

const databaseUrl = hasExplicitR1P08CatalogDatabase()
  ? requireR1P08CatalogDatabaseUrl()
  : undefined;
const databaseDescribe = databaseUrl === undefined ? describe.skip : describe.sequential;

databaseDescribe("R1-P08 live disposable Catalog proofs", () => {
  let prisma: PrismaClient;
  const prefix = `r1p08live${process.pid}${Date.now()}`;

  beforeAll(async () => {
    if (databaseUrl === undefined) {
      throw new Error("CLEANORA_R1_P08_DATABASE_URL is required");
    }
    await ensureR1P08CatalogDatabaseMigrated(databaseUrl);
    prisma = await createConnectedMigrationProofCatalogClient(databaseUrl);
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      try {
        await cleanupCatalogTestRows(prisma, {
          actorUserIdPrefix: "r1p08live",
          recordIdPrefix: "r1p08live",
          categoryCodePrefix: "R1P08_",
          serviceCodePrefix: "R1P08_",
        });
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  it("T034/T052 creates inactive category and service with AR/EN translations", async () => {
    const repo = createLiveCatalogRepository(prisma);
    const suffix = String(Date.now()).slice(-8);
    let storedServiceId = "";

    await prisma.$transaction(async (tx) => {
      const order = await repo.nextCategoryDisplayOrder(tx);
      const category = await repo.insertCategory(tx, {
        code: `R1P08_LIVE_CAT_${suffix}`,
        displayOrder: order,
        nameAr: null,
        nameEn: null,
        descriptionAr: null,
        descriptionEn: null,
      });

      const serviceOrder = await repo.nextServiceDisplayOrder(tx, category.id);
      const service = await repo.insertService(tx, {
        categoryId: category.id,
        code: `R1P08_LIVE_SVC_${suffix}`,
        displayOrder: serviceOrder,
        translations: [
          { locale: "AR", name: "خدمة", description: "وصف" },
          { locale: "EN", name: "Service", description: "Description" },
        ],
      });
      storedServiceId = service.id;
    }, LIVE_CATALOG_TRANSACTION_OPTIONS);

    const stored = await repo.findService(prisma as never, storedServiceId);
    expect(stored?.isActive).toBe(false);
    expect(stored?.translations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: "AR", name: "خدمة" }),
        expect.objectContaining({ locale: "EN", name: "Service" }),
      ]),
    );
  });

  it("T060/T082 double seed preserves DEC-044 Egypt housekeeping counts", async () => {
    await ensureR1P08CatalogSeeded(prisma);
    const first = await readCatalogSeedCounts(prisma);
    await ensureR1P08CatalogSeeded(prisma);
    const second = await readCatalogSeedCounts(prisma);
    expect(first).toEqual(second);
    expect(first).toEqual({
      categories: 1,
      services: 1,
      translations: 2,
      priceUnits: 2,
      fields: 5,
      availability: 1,
    });
  });

  it("T038/T080/T071 rejects duplicate category codes under concurrent writers", async () => {
    const suffix = String(Date.now()).slice(-6);
    const code = `R1P08_RACE_${suffix}`;
    const outcomes = await Promise.allSettled(
      [0, 1].map((index) =>
        prisma.serviceCategory.create({
          data: {
            id: `${prefix}race${index}`,
            code,
            displayOrder: 9000 + index,
            isActive: false,
            version: 1,
          },
        }),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  });

  it("T060 live rejects invalid field-kind constraint shapes", async () => {
    const service = await prisma.service.findFirstOrThrow({
      where: { code: "STANDARD_HOME_CLEANING" },
      select: { id: true },
    });
    await expectR1P07ConstraintRejection("INFORMATION marked required", "23514", () =>
      prisma.$executeRawUnsafe(`
        INSERT INTO "service_fields" (
          "id", "service_id", "code", "kind", "is_required", "display_order", "is_active", "updated_at"
        ) VALUES (
          '${prefix}-invalid-information', '${service.id}', 'LIVE_INVALID_INFORMATION',
          'INFORMATION', true, 999, false, CURRENT_TIMESTAMP
        )
      `));
  });

  it("T078/T090 propagates child service versions when category order changes", async () => {
    await ensureR1P08CatalogSeeded(prisma);
    const repo = createLiveCatalogRepository(prisma);
    const category = await prisma.serviceCategory.findFirstOrThrow({
      where: { code: "HOME_CLEANING" },
    });
    const serviceBefore = await prisma.service.findFirstOrThrow({
      where: { code: "STANDARD_HOME_CLEANING" },
      select: { version: true },
    });

    await prisma.$transaction(async (tx) => {
      await repo.replaceCategoryOrder(tx as never, {
        orderedIds: [category.id],
        positions: [category.displayOrder],
      });
    }, LIVE_CATALOG_TRANSACTION_OPTIONS);

    const serviceAfter = await prisma.service.findFirstOrThrow({
      where: { code: "STANDARD_HOME_CLEANING" },
      select: { version: true },
    });
    expect(serviceAfter.version).toBe(serviceBefore.version + 1);
  });

  it("T071 allows exactly one configuration winner under concurrent writers", async () => {
    if (databaseUrl === undefined) {
      return;
    }
    await ensureR1P08CatalogSeeded(prisma);
    const writerA = await createConnectedMigrationProofCatalogClient(databaseUrl);
    const writerB = await createConnectedMigrationProofCatalogClient(databaseUrl);
    const repoA = createLiveCatalogRepository(writerA);
    const repoB = createLiveCatalogRepository(writerB);
    const existing = await repoA.findServiceWithConfiguration(
      writerA as never,
      (
        await writerA.service.findFirstOrThrow({
          where: { code: "STANDARD_HOME_CLEANING" },
          select: { id: true },
        })
      ).id,
    );
    expect(existing).not.toBeNull();
    if (existing === null) {
      await writerA.$disconnect();
      await writerB.$disconnect();
      return;
    }

    const baseInput = toConfigurationReplacementInput(existing);
    const outcomes = await Promise.allSettled([
      writerA.$transaction(
        (tx) =>
          repoA.replaceServiceConfiguration(tx as never, {
            ...baseInput,
            priceUnits: baseInput.priceUnits.map((unit, index) =>
              index === 0
                ? { ...unit, labelEn: "Winner update" }
                : unit,
            ),
          }),
        LIVE_CATALOG_TRANSACTION_OPTIONS,
      ),
      writerB.$transaction(
        (tx) =>
          repoB.replaceServiceConfiguration(tx as never, {
            ...baseInput,
            priceUnits: baseInput.priceUnits.map((unit, index) =>
              index === 0
                ? { ...unit, labelEn: "Loser update" }
                : unit,
            ),
          }),
        LIVE_CATALOG_TRANSACTION_OPTIONS,
      ),
    ]);
    await writerA.$disconnect();
    await writerB.$disconnect();

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const failure = rejected[0];
    expect(failure?.status).toBe("rejected");
    if (failure?.status === "rejected") {
      expect(failure.reason).toBeInstanceOf(CatalogError);
      expect((failure.reason as CatalogError).code).toBe("CATALOG_VERSION_CONFLICT");
    }
  });
});

async function readCatalogSeedCounts(prisma: PrismaClient): Promise<{
  readonly categories: number;
  readonly services: number;
  readonly translations: number;
  readonly priceUnits: number;
  readonly fields: number;
  readonly availability: number;
}> {
  const [
    categories,
    services,
    translations,
    priceUnits,
    fields,
    availability,
  ] = await Promise.all([
    prisma.serviceCategory.count({ where: { code: "HOME_CLEANING" } }),
    prisma.service.count({ where: { code: "STANDARD_HOME_CLEANING" } }),
    prisma.serviceTranslation.count({
      where: { service: { code: "STANDARD_HOME_CLEANING" } },
    }),
    prisma.servicePriceUnit.count({
      where: { service: { code: "STANDARD_HOME_CLEANING" } },
    }),
    prisma.serviceField.count({
      where: { service: { code: "STANDARD_HOME_CLEANING" } },
    }),
    prisma.serviceCountryAvailability.count({
      where: { service: { code: "STANDARD_HOME_CLEANING" } },
    }),
  ]);
  return { categories, services, translations, priceUnits, fields, availability };
}

function toConfigurationReplacementInput(
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createLiveCatalogRepository>["findServiceWithConfiguration"]>>>,
): CatalogServiceConfigurationReplacementInput {
  return {
    serviceId: row.id,
    expectedVersion: row.version,
    translations: row.translations.map((translation) => ({
      locale: translation.locale,
      name: translation.name,
      description: translation.description,
    })),
    priceUnits: row.priceUnits.map((unit) => ({
      code: unit.code,
      labelAr: unit.labelAr,
      labelEn: unit.labelEn,
      isActive: unit.isActive,
    })),
    fields: row.fields.map((field) => ({
      code: field.code,
      kind: field.kind,
      labelAr: field.labelAr,
      labelEn: field.labelEn,
      helpTextAr: field.helpTextAr,
      helpTextEn: field.helpTextEn,
      isRequired: field.isRequired,
      isActive: field.isActive,
      minLength: field.minLength,
      maxLength: field.maxLength,
      numberMode: field.numberMode,
      minValue: field.minValue,
      maxValue: field.maxValue,
      minSelections: field.minSelections,
      maxSelections: field.maxSelections,
      options: field.options.map((option) => ({
        value: option.value,
        labelAr: option.labelAr,
        labelEn: option.labelEn,
        isActive: option.isActive,
      })),
    })),
  };
}
