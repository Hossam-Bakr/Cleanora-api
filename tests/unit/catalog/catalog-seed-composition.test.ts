
import { Prisma } from "../../../src/generated/prisma/client.js";
import { EGYPT_HOUSEKEEPING_SEED } from "../../../src/modules/catalog/catalog.policy.js";
import {
  resolveSeedDisplayOrder,
  seedR1P08Catalog,
} from "../../../prisma/seed.js";

type CatalogLocale = "AR" | "EN";

interface MemoryCategory {
  id: string;
  code: string;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  displayOrder: number;
  isActive: boolean;
  version: number;
}

interface MemoryService {
  id: string;
  categoryId: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  version: number;
}

interface MemoryTranslation {
  id: string;
  serviceId: string;
  locale: CatalogLocale;
  name: string | null;
  description: string | null;
}

interface MemoryPriceUnit {
  id: string;
  serviceId: string;
  code: string;
  labelAr: string | null;
  labelEn: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface MemoryField {
  id: string;
  serviceId: string;
  code: string;
  kind: string;
  labelAr: string | null;
  labelEn: string | null;
  helpTextAr: string | null;
  helpTextEn: string | null;
  isRequired: boolean;
  isActive: boolean;
  minLength: number | null;
  maxLength: number | null;
  numberMode: string | null;
  minValue: Prisma.Decimal | null;
  maxValue: Prisma.Decimal | null;
  minSelections: number | null;
  maxSelections: number | null;
  displayOrder: number;
}

interface MemoryAvailability {
  id: string;
  serviceId: string;
  countryId: string;
  isAvailable: boolean;
}

interface OperationRecord {
  readonly model: string;
  readonly action: "create" | "update";
  readonly data: Record<string, unknown>;
}

class CatalogSeedMemoryDatabase {
  private nextId = 1;

  readonly categories = new Map<string, MemoryCategory>();
  readonly services = new Map<string, MemoryService>();
  readonly translations = new Map<string, MemoryTranslation>();
  readonly priceUnits = new Map<string, MemoryPriceUnit>();
  readonly fields = new Map<string, MemoryField>();
  readonly availability = new Map<string, MemoryAvailability>();
  readonly operations: OperationRecord[] = [];

  readonly serviceMediaAssociation = {
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  };

  private id(prefix: string): string {
    const value = `${prefix}-${this.nextId}`;
    this.nextId += 1;
    return value;
  }

  private record(
    model: string,
    action: OperationRecord["action"],
    data: Record<string, unknown>,
  ): void {
    this.operations.push({ model, action, data });
  }

  readonly serviceCategory = {
    findUnique: vi.fn(async ({ where }: { where: { code: string } }) => {
      for (const row of this.categories.values()) {
        if (row.code === where.code) {
          return { ...row };
        }
      }
      return null;
    }),
    findMany: vi.fn(async ({ select }: { select?: { displayOrder?: true } }) => {
      const rows = [...this.categories.values()];
      if (select?.displayOrder) {
        return rows.map((row) => ({ displayOrder: row.displayOrder }));
      }
      return rows.map((row) => ({ ...row }));
    }),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryCategory, "id">;
      }) => {
        const row: MemoryCategory = { id: this.id("category"), ...data };
        this.categories.set(row.id, row);
        this.record("serviceCategory", "create", { ...data });
        return { ...row };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.categories.get(where.id);
        if (row === undefined) {
          throw new Error(`Missing category ${where.id}`);
        }
        this.record("serviceCategory", "update", { ...data });
        return { ...row };
      },
    ),
  };

  readonly service = {
    findUnique: vi.fn(async ({ where }: { where: { code: string } }) => {
      for (const row of this.services.values()) {
        if (row.code === where.code) {
          return { ...row };
        }
      }
      return null;
    }),
    findMany: vi.fn(
      async ({
        where,
        select,
      }: {
        where?: { categoryId?: string };
        select?: { displayOrder?: true };
      }) => {
        const rows = [...this.services.values()].filter((row) =>
          where?.categoryId === undefined ? true : row.categoryId === where.categoryId,
        );
        if (select?.displayOrder) {
          return rows.map((row) => ({ displayOrder: row.displayOrder }));
        }
        return rows.map((row) => ({ ...row }));
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryService, "id">;
      }) => {
        const row: MemoryService = { id: this.id("service"), ...data };
        this.services.set(row.id, row);
        this.record("service", "create", { ...data });
        return { ...row };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.services.get(where.id);
        if (row === undefined) {
          throw new Error(`Missing service ${where.id}`);
        }
        this.record("service", "update", { ...data });
        return { ...row };
      },
    ),
  };

  readonly serviceTranslation = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { serviceId_locale: { serviceId: string; locale: CatalogLocale } };
      }) => {
        for (const row of this.translations.values()) {
          if (
            row.serviceId === where.serviceId_locale.serviceId &&
            row.locale === where.serviceId_locale.locale
          ) {
            return { ...row };
          }
        }
        return null;
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryTranslation, "id">;
      }) => {
        const row: MemoryTranslation = { id: this.id("translation"), ...data };
        this.translations.set(row.id, row);
        this.record("serviceTranslation", "create", { ...data });
        return { ...row };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.translations.get(where.id);
        if (row === undefined) {
          throw new Error(`Missing translation ${where.id}`);
        }
        this.record("serviceTranslation", "update", { ...data });
        return { ...row };
      },
    ),
  };

  readonly servicePriceUnit = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { serviceId_code: { serviceId: string; code: string } };
      }) => {
        for (const row of this.priceUnits.values()) {
          if (
            row.serviceId === where.serviceId_code.serviceId &&
            row.code === where.serviceId_code.code
          ) {
            return { ...row };
          }
        }
        return null;
      },
    ),
    findMany: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { serviceId: string };
        select?: { displayOrder?: true };
      }) => {
        const rows = [...this.priceUnits.values()].filter(
          (row) => row.serviceId === where.serviceId,
        );
        if (select?.displayOrder) {
          return rows.map((row) => ({ displayOrder: row.displayOrder }));
        }
        return rows.map((row) => ({ ...row }));
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryPriceUnit, "id">;
      }) => {
        const row: MemoryPriceUnit = { id: this.id("price-unit"), ...data };
        this.priceUnits.set(row.id, row);
        this.record("servicePriceUnit", "create", { ...data });
        return { ...row };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.priceUnits.get(where.id);
        if (row === undefined) {
          throw new Error(`Missing price unit ${where.id}`);
        }
        this.record("servicePriceUnit", "update", { ...data });
        return { ...row };
      },
    ),
  };

  readonly serviceField = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { serviceId_code: { serviceId: string; code: string } };
      }) => {
        for (const row of this.fields.values()) {
          if (
            row.serviceId === where.serviceId_code.serviceId &&
            row.code === where.serviceId_code.code
          ) {
            return { ...row };
          }
        }
        return null;
      },
    ),
    findMany: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { serviceId: string };
        select?: { displayOrder?: true };
      }) => {
        const rows = [...this.fields.values()].filter(
          (row) => row.serviceId === where.serviceId,
        );
        if (select?.displayOrder) {
          return rows.map((row) => ({ displayOrder: row.displayOrder }));
        }
        return rows.map((row) => ({ ...row }));
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryField, "id">;
      }) => {
        const row: MemoryField = { id: this.id("field"), ...data };
        this.fields.set(row.id, row);
        this.record("serviceField", "create", { ...data });
        return { ...row };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.fields.get(where.id);
        if (row === undefined) {
          throw new Error(`Missing field ${where.id}`);
        }
        this.record("serviceField", "update", { ...data });
        return { ...row };
      },
    ),
  };

  readonly serviceCountryAvailability = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { serviceId_countryId: { serviceId: string; countryId: string } };
      }) => {
        for (const row of this.availability.values()) {
          if (
            row.serviceId === where.serviceId_countryId.serviceId &&
            row.countryId === where.serviceId_countryId.countryId
          ) {
            return { ...row };
          }
        }
        return null;
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryAvailability, "id">;
      }) => {
        const row: MemoryAvailability = { id: this.id("availability"), ...data };
        this.availability.set(row.id, row);
        this.record("serviceCountryAvailability", "create", { ...data });
        return { ...row };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.availability.get(where.id);
        if (row === undefined) {
          throw new Error(`Missing availability ${where.id}`);
        }
        this.record("serviceCountryAvailability", "update", { ...data });
        return { ...row };
      },
    ),
  };

  asClient() {
    const client = this as unknown as CatalogSeedMemoryDatabase & {
      $transaction: (
        work: (transaction: CatalogSeedMemoryDatabase) => Promise<unknown>,
      ) => Promise<unknown>;
    };
    client.$transaction = vi.fn(
      async (work: (transaction: CatalogSeedMemoryDatabase) => Promise<unknown>) =>
        work(this),
    );
    return client;
  }
}

const EG_COUNTRY = { id: "country-eg", code: "EG" };

function createOperations(database: CatalogSeedMemoryDatabase) {
  return database.operations;
}

function categoryCreate(database: CatalogSeedMemoryDatabase) {
  return database.operations.find(
    (operation) =>
      operation.model === "serviceCategory" && operation.action === "create",
  )?.data;
}

function serviceCreate(database: CatalogSeedMemoryDatabase) {
  return database.operations.find(
    (operation) => operation.model === "service" && operation.action === "create",
  )?.data;
}

function priceUnitCreates(database: CatalogSeedMemoryDatabase) {
  return database.operations.filter(
    (operation) =>
      operation.model === "servicePriceUnit" && operation.action === "create",
  );
}

function fieldCreates(database: CatalogSeedMemoryDatabase) {
  return database.operations.filter(
    (operation) => operation.model === "serviceField" && operation.action === "create",
  );
}

function updateOperations(database: CatalogSeedMemoryDatabase) {
  return database.operations.filter((operation) => operation.action === "update");
}

/**
 * US3 T091–T092 DEC-044 seed composition (FR-047–FR-049). Fake Prisma only —
 * not a PostgreSQL proof.
 */
describe("catalog seed composition (US3 / DEC-044)", () => {
  let database: CatalogSeedMemoryDatabase;

  beforeEach(() => {
    database = new CatalogSeedMemoryDatabase();
  });

  it("creates the exact DEC-044 graph on an empty baseline", async () => {
    const client = database.asClient();
    await seedR1P08Catalog(client as never, EG_COUNTRY);

    expect(categoryCreate(database)).toEqual({
      code: EGYPT_HOUSEKEEPING_SEED.category.code,
      nameAr: EGYPT_HOUSEKEEPING_SEED.category.nameAr,
      nameEn: EGYPT_HOUSEKEEPING_SEED.category.nameEn,
      descriptionAr: EGYPT_HOUSEKEEPING_SEED.category.descriptionAr,
      descriptionEn: EGYPT_HOUSEKEEPING_SEED.category.descriptionEn,
      displayOrder: 0,
      isActive: true,
      version: 1,
    });

    expect(serviceCreate(database)).toMatchObject({
      code: EGYPT_HOUSEKEEPING_SEED.service.code,
      displayOrder: 0,
      isActive: true,
      version: 1,
    });

    const createdServiceId = [...database.services.values()][0]?.id;
    expect(createdServiceId).toBeDefined();

    expect(priceUnitCreates(database)).toHaveLength(2);
    expect(priceUnitCreates(database)[0]?.data).toEqual({
      serviceId: createdServiceId,
      code: "PER_VISIT",
      labelEn: "Per visit",
      labelAr: "لكل زيارة",
      displayOrder: 0,
      isActive: true,
    });
    expect(priceUnitCreates(database)[1]?.data).toEqual({
      serviceId: createdServiceId,
      code: "PER_HOUR",
      labelEn: "Per hour",
      labelAr: "لكل ساعة",
      displayOrder: 1,
      isActive: true,
    });

    expect(fieldCreates(database)).toHaveLength(5);
    expect(fieldCreates(database).map((operation) => operation.data["code"])).toEqual([
      "PREPARATION_INFORMATION",
      "BEDROOM_COUNT",
      "BATHROOM_COUNT",
      "PETS_PRESENT",
      "SPECIAL_INSTRUCTIONS",
    ]);

    const bedroomField = fieldCreates(database).find(
      (operation) => operation.data["code"] === "BEDROOM_COUNT",
    )?.data;
    expect(bedroomField).toMatchObject({
      kind: "NUMBER",
      numberMode: "INTEGER",
      minValue: expect.any(Prisma.Decimal),
      displayOrder: 1,
      isActive: true,
    });

    const availabilityCreate = database.operations.find(
      (operation) =>
        operation.model === "serviceCountryAvailability" &&
        operation.action === "create",
    )?.data;
    expect(availabilityCreate).toEqual({
      serviceId: createdServiceId,
      countryId: EG_COUNTRY.id,
      isAvailable: true,
    });

    expect(database.serviceMediaAssociation.create).not.toHaveBeenCalled();
    expect(database.serviceMediaAssociation.update).not.toHaveBeenCalled();
    expect(database.serviceMediaAssociation.upsert).not.toHaveBeenCalled();
  });

  it("uses empty update branches for every existing stable identity on rerun", async () => {
    database.categories.set("category-1", {
      id: "category-1",
      code: "HOME_CLEANING",
      nameAr: "Owner AR",
      nameEn: "Owner EN",
      descriptionAr: "Owner desc AR",
      descriptionEn: "Owner desc EN",
      displayOrder: 4,
      isActive: false,
      version: 7,
    });
    database.services.set("service-1", {
      id: "service-1",
      categoryId: "category-1",
      code: "STANDARD_HOME_CLEANING",
      displayOrder: 2,
      isActive: false,
      version: 11,
    });
    database.translations.set("translation-ar", {
      id: "translation-ar",
      serviceId: "service-1",
      locale: "AR",
      name: "Owner AR service",
      description: "Owner AR desc",
    });
    database.translations.set("translation-en", {
      id: "translation-en",
      serviceId: "service-1",
      locale: "EN",
      name: "Owner EN service",
      description: "Owner EN desc",
    });
    database.priceUnits.set("unit-1", {
      id: "unit-1",
      serviceId: "service-1",
      code: "PER_VISIT",
      labelAr: "Owner visit AR",
      labelEn: "Owner visit EN",
      displayOrder: 0,
      isActive: false,
    });
    database.priceUnits.set("unit-2", {
      id: "unit-2",
      serviceId: "service-1",
      code: "PER_HOUR",
      labelAr: "Owner hour AR",
      labelEn: "Owner hour EN",
      displayOrder: 1,
      isActive: false,
    });
    for (const [index, code] of EGYPT_HOUSEKEEPING_SEED.fields.entries()) {
      database.fields.set(`field-${index}`, {
        id: `field-${index}`,
        serviceId: "service-1",
        code: code.code,
        kind: code.kind,
        labelAr: `Owner ${code.code} AR`,
        labelEn: `Owner ${code.code} EN`,
        helpTextAr: null,
        helpTextEn: null,
        isRequired: true,
        isActive: false,
        minLength: null,
        maxLength: null,
        numberMode: code.numberMode,
        minValue: code.minValue === null ? null : new Prisma.Decimal(code.minValue),
        maxValue: null,
        minSelections: null,
        maxSelections: null,
        displayOrder: code.displayOrder,
      });
    }
    database.availability.set("availability-1", {
      id: "availability-1",
      serviceId: "service-1",
      countryId: EG_COUNTRY.id,
      isAvailable: false,
    });

    const client = database.asClient();
    await seedR1P08Catalog(client as never, EG_COUNTRY);

    expect(createOperations(database).filter((operation) => operation.action === "create")).toHaveLength(0);
    expect(updateOperations(database).length).toBeGreaterThan(0);
    for (const operation of updateOperations(database)) {
      expect(operation.data).toEqual({});
    }

    expect(database.categories.get("category-1")).toMatchObject({
      isActive: false,
      nameEn: "Owner EN",
      displayOrder: 4,
      version: 7,
    });
    expect(database.services.get("service-1")).toMatchObject({
      isActive: false,
      displayOrder: 2,
      version: 11,
    });
    expect(database.availability.get("availability-1")).toMatchObject({
      isAvailable: false,
    });
  });

  it("appends the next display order when creating a missing row in a non-empty scope", async () => {
    database.categories.set("category-existing", {
      id: "category-existing",
      code: "OTHER_CATEGORY",
      nameAr: "Other AR",
      nameEn: "Other EN",
      descriptionAr: "Other AR desc",
      descriptionEn: "Other EN desc",
      displayOrder: 0,
      isActive: true,
      version: 1,
    });

    const client = database.asClient();
    await seedR1P08Catalog(client as never, EG_COUNTRY);

    expect(categoryCreate(database)).toMatchObject({
      code: "HOME_CLEANING",
      displayOrder: 1,
    });
    expect(resolveSeedDisplayOrder([0], 0)).toBe(1);
  });

  it("does not introduce duplicate natural identities on a second composition run", async () => {
    const client = database.asClient();
    await seedR1P08Catalog(client as never, EG_COUNTRY);
    const firstCreateCount = createOperations(database).filter(
      (operation) => operation.action === "create",
    ).length;

    await seedR1P08Catalog(client as never, EG_COUNTRY);
    const secondCreateCount = createOperations(database).filter(
      (operation) => operation.action === "create",
    ).length;

    expect(firstCreateCount).toBeGreaterThan(0);
    expect(secondCreateCount).toBe(firstCreateCount);
    expect(database.categories.size).toBe(1);
    expect(database.services.size).toBe(1);
    expect(database.priceUnits.size).toBe(2);
    expect(database.fields.size).toBe(5);
    expect(database.availability.size).toBe(1);
  });

  it("remains neutral on OQ-002 and never composes Media associations", async () => {
    const client = database.asClient();
    await seedR1P08Catalog(client as never, EG_COUNTRY);

    const serialized = JSON.stringify(createOperations(database));
    expect(serialized.toLowerCase()).not.toMatch(
      /materials|bring your own|customer.?supplies|provider.?supplies/,
    );
    expect(database.serviceMediaAssociation.create).not.toHaveBeenCalled();
    expect(database.serviceMediaAssociation.update).not.toHaveBeenCalled();
    expect(database.serviceMediaAssociation.upsert).not.toHaveBeenCalled();
    expect(database.serviceMediaAssociation.findMany).not.toHaveBeenCalled();
  });
});
