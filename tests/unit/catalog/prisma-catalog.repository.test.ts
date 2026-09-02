
import { Prisma } from "../../../src/generated/prisma/client.js";
import {
  acquireCatalogIdempotencyLock,
  PrismaCatalogRepository,
} from "../../../src/modules/catalog/catalog.repository.js";

type Locale = "AR" | "EN";

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
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryService {
  id: string;
  categoryId: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryTranslation {
  id: string;
  serviceId: string;
  locale: Locale;
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

interface MemoryFieldOption {
  id: string;
  serviceFieldId: string;
  value: string;
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

interface MemoryMediaFile {
  id: string;
  contentType: string;
  width: number | null;
  height: number | null;
  status: string;
  ownerUserId: string;
}

interface MemoryMediaAssociation {
  id: string;
  serviceId: string;
  mediaFileId: string;
  displayOrder: number;
}

interface MemoryCommand {
  id: string;
  actorUserId: string;
  scopeKey: string;
  idempotencyKey: string;
  requestHash: string;
  status: "PENDING" | "COMPLETED";
  targetType: string;
  targetId: string | null;
  acceptedVersion: number | null;
  reservedMediaFileId: string | null;
  completedAt: Date | null;
}

interface MemoryCountry {
  id: string;
  code: string;
}

const NOW = new Date("2026-09-01T00:00:00.000Z");

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

function applyMutation(
  row: Record<string, unknown>,
  data: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(data)) {
    if (
      value !== null &&
      typeof value === "object" &&
      "increment" in (value as object)
    ) {
      row[key] =
        Number(row[key] ?? 0) +
        Number((value as { increment: number }).increment);
    } else {
      row[key] = value as unknown;
    }
  }
}

function matchesWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
): boolean {
  if (where === undefined) {
    return true;
  }
  for (const [key, expected] of Object.entries(where)) {
    if (
      expected !== null &&
      typeof expected === "object" &&
      "in" in (expected as object)
    ) {
      const values = (expected as { in: unknown[] }).in;
      if (!values.includes(row[key])) {
        return false;
      }
      continue;
    }
    if (
      expected !== null &&
      typeof expected === "object" &&
      "isActive" in (expected as object)
    ) {
      // nested relation filter handled elsewhere
      continue;
    }
    if (
      expected !== null &&
      typeof expected === "object" &&
      "some" in (expected as object)
    ) {
      continue;
    }
    if (row[key] !== expected) {
      return false;
    }
  }
  return true;
}

function sortByDisplayOrderThenId<T extends { displayOrder: number; id: string }>(
  rows: T[],
): T[] {
  return rows.slice().sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }
    return left.id.localeCompare(right.id);
  });
}

class CatalogMemoryDatabase {
  /** High watermark avoids colliding with explicitly seeded ids like avail-1/unit-2. */
  private seq = 1000;

  readonly categories = new Map<string, MemoryCategory>();
  readonly services = new Map<string, MemoryService>();
  readonly translations = new Map<string, MemoryTranslation>();
  readonly priceUnits = new Map<string, MemoryPriceUnit>();
  readonly fields = new Map<string, MemoryField>();
  readonly options = new Map<string, MemoryFieldOption>();
  readonly availability = new Map<string, MemoryAvailability>();
  readonly mediaFiles = new Map<string, MemoryMediaFile>();
  readonly mediaAssociations = new Map<string, MemoryMediaAssociation>();
  readonly commands = new Map<string, MemoryCommand>();
  readonly countries = new Map<string, MemoryCountry>();

  forceUniqueConflict = false;
  hideCategoryAfterUpdate = false;
  hideServiceAfterUpdate = false;

  private id(prefix: string): string {
    const value = `${prefix}-${this.seq}`;
    this.seq += 1;
    return value;
  }

  seedCountry(id: string, code: string): MemoryCountry {
    const row = { id, code };
    this.countries.set(id, row);
    return row;
  }

  seedCategory(
    partial: Partial<MemoryCategory> & Pick<MemoryCategory, "id" | "code">,
  ): MemoryCategory {
    const row: MemoryCategory = {
      nameAr: null,
      nameEn: null,
      descriptionAr: null,
      descriptionEn: null,
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...partial,
    };
    this.categories.set(row.id, row);
    return row;
  }

  seedService(
    partial: Partial<MemoryService> &
      Pick<MemoryService, "id" | "categoryId" | "code">,
  ): MemoryService {
    const row: MemoryService = {
      displayOrder: 0,
      isActive: true,
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...partial,
    };
    this.services.set(row.id, row);
    return row;
  }

  seedTranslation(
    partial: Omit<MemoryTranslation, "id"> & { id?: string },
  ): MemoryTranslation {
    const row: MemoryTranslation = {
      id: partial.id ?? this.id("tr"),
      serviceId: partial.serviceId,
      locale: partial.locale,
      name: partial.name,
      description: partial.description,
    };
    this.translations.set(row.id, row);
    return row;
  }

  seedMediaFile(
    partial: Partial<MemoryMediaFile> & Pick<MemoryMediaFile, "id">,
  ): MemoryMediaFile {
    const row: MemoryMediaFile = {
      contentType: "image/jpeg",
      width: 100,
      height: 80,
      status: "READY",
      ownerUserId: "user-1",
      ...partial,
    };
    this.mediaFiles.set(row.id, row);
    return row;
  }

  private translationsFor(serviceId: string): MemoryTranslation[] {
    return [...this.translations.values()]
      .filter((row) => row.serviceId === serviceId)
      .sort((left, right) => left.locale.localeCompare(right.locale));
  }

  private priceUnitsFor(serviceId: string): MemoryPriceUnit[] {
    return sortByDisplayOrderThenId(
      [...this.priceUnits.values()].filter((row) => row.serviceId === serviceId),
    );
  }

  private optionsFor(fieldId: string): MemoryFieldOption[] {
    return sortByDisplayOrderThenId(
      [...this.options.values()].filter((row) => row.serviceFieldId === fieldId),
    );
  }

  private fieldsFor(serviceId: string) {
    return sortByDisplayOrderThenId(
      [...this.fields.values()].filter((row) => row.serviceId === serviceId),
    ).map((field) => ({
      ...field,
      options: this.optionsFor(field.id),
    }));
  }

  private hydrateService(
    service: MemoryService,
    include?: {
      translations?: boolean;
      priceUnits?: boolean;
      fields?: boolean | { include?: { options?: boolean } };
      category?: boolean;
      countryRows?: { where?: { countryId?: string } };
    },
  ) {
    const base: Record<string, unknown> = { ...service };
    if (include?.translations) {
      base["translations"] = this.translationsFor(service.id);
    }
    if (include?.priceUnits) {
      base["priceUnits"] = this.priceUnitsFor(service.id);
    }
    if (include?.fields) {
      base["fields"] = this.fieldsFor(service.id);
    }
    if (include?.category) {
      base["category"] = this.categories.get(service.categoryId) ?? null;
    }
    if (include?.countryRows) {
      const countryId = include.countryRows.where?.countryId;
      base["countryRows"] = [...this.availability.values()]
        .filter(
          (row) =>
            row.serviceId === service.id &&
            (countryId === undefined || row.countryId === countryId),
        )
        .map((row) => ({
          ...row,
          country: this.countries.get(row.countryId) ?? {
            id: row.countryId,
            code: "??",
          },
        }));
    }
    return base;
  }

  private applyCursorTake<T extends { id: string }>(
    rows: T[],
    args: {
      cursor?: { id: string };
      skip?: number;
      take?: number;
    },
  ): T[] {
    let page = rows;
    if (args.cursor !== undefined) {
      const index = page.findIndex((row) => row.id === args.cursor!.id);
      page = index >= 0 ? page.slice(index) : page;
    }
    if (args.skip !== undefined && args.skip > 0) {
      page = page.slice(args.skip);
    }
    if (args.take !== undefined) {
      page = page.slice(0, args.take);
    }
    return page;
  }

  readonly catalogCommandRequest = {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          actorUserId_scopeKey_idempotencyKey: {
            actorUserId: string;
            scopeKey: string;
            idempotencyKey: string;
          };
        };
      }) => {
        for (const row of this.commands.values()) {
          if (
            row.actorUserId ===
              where.actorUserId_scopeKey_idempotencyKey.actorUserId &&
            row.scopeKey === where.actorUserId_scopeKey_idempotencyKey.scopeKey &&
            row.idempotencyKey ===
              where.actorUserId_scopeKey_idempotencyKey.idempotencyKey
          ) {
            return { ...row };
          }
        }
        return null;
      },
    ),
    create: vi.fn(async ({ data }: { data: Omit<MemoryCommand, "id" | "completedAt"> & { completedAt?: Date | null } }) => {
      if (this.forceUniqueConflict) {
        throw p2002();
      }
      const row: MemoryCommand = {
        id: this.id("cmd"),
        completedAt: data.completedAt ?? null,
        acceptedVersion: data.acceptedVersion ?? null,
        reservedMediaFileId: data.reservedMediaFileId ?? null,
        targetId: data.targetId ?? null,
        actorUserId: data.actorUserId,
        scopeKey: data.scopeKey,
        idempotencyKey: data.idempotencyKey,
        requestHash: data.requestHash,
        status: data.status,
        targetType: data.targetType,
      };
      this.commands.set(row.id, row);
      return { ...row };
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = this.commands.get(where.id);
        if (row === undefined) {
          throw new Error(`missing command ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
  };

  readonly serviceCategory = {
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; code?: string } }) => {
        if (where.id !== undefined) {
          if (this.hideCategoryAfterUpdate) {
            return null;
          }
          const row = this.categories.get(where.id);
          return row === undefined ? null : { ...row };
        }
        if (where.code !== undefined) {
          for (const row of this.categories.values()) {
            if (row.code === where.code) {
              return { ...row };
            }
          }
        }
        return null;
      },
    ),
    findMany: vi.fn(
      async (args: {
        cursor?: { id: string };
        skip?: number;
        take?: number;
        orderBy?: unknown;
      }) => {
        const rows = sortByDisplayOrderThenId([...this.categories.values()]);
        return this.applyCursorTake(rows, args).map((row) => ({ ...row }));
      },
    ),
    aggregate: vi.fn(async () => {
      const orders = [...this.categories.values()].map((row) => row.displayOrder);
      return {
        _max: {
          displayOrder: orders.length === 0 ? null : Math.max(...orders),
        },
      };
    }),
    create: vi.fn(async ({ data }: { data: Omit<MemoryCategory, "id" | "createdAt" | "updatedAt"> }) => {
      if (this.forceUniqueConflict) {
        throw p2002();
      }
      const row: MemoryCategory = {
        id: this.id("cat"),
        createdAt: NOW,
        updatedAt: NOW,
        ...data,
      };
      this.categories.set(row.id, row);
      return { ...row };
    }),
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
          throw new Error(`missing category ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const row of this.categories.values()) {
          if (matchesWhere(row as unknown as Record<string, unknown>, where)) {
            applyMutation(row as unknown as Record<string, unknown>, data);
            count += 1;
          }
        }
        return { count };
      },
    ),
  };

  readonly service = {
    findUnique: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { id?: string; code?: string };
        include?: Parameters<CatalogMemoryDatabase["hydrateService"]>[1];
      }) => {
        let found: MemoryService | undefined;
        if (where.id !== undefined) {
          if (this.hideServiceAfterUpdate) {
            return null;
          }
          found = this.services.get(where.id);
        } else if (where.code !== undefined) {
          found = [...this.services.values()].find((row) => row.code === where.code);
        }
        if (found === undefined) {
          return null;
        }
        return this.hydrateService(found, include);
      },
    ),
    findMany: vi.fn(
      async (args: {
        where?: Record<string, unknown>;
        cursor?: { id: string };
        skip?: number;
        take?: number;
        orderBy?: unknown;
        include?: Parameters<CatalogMemoryDatabase["hydrateService"]>[1];
      }) => {
        let rows = [...this.services.values()];
        const where = args.where ?? {};
        if (typeof where["categoryId"] === "string") {
          rows = rows.filter((row) => row.categoryId === where["categoryId"]);
        }
        if (where["isActive"] === true) {
          rows = rows.filter((row) => row.isActive);
        }
        if (
          where["category"] !== undefined &&
          typeof where["category"] === "object" &&
          (where["category"] as { isActive?: boolean }).isActive === true
        ) {
          rows = rows.filter((row) => {
            const category = this.categories.get(row.categoryId);
            return category?.isActive === true;
          });
        }
        if (
          where["countryRows"] !== undefined &&
          typeof where["countryRows"] === "object" &&
          "some" in (where["countryRows"] as object)
        ) {
          const some = (
            where["countryRows"] as {
              some: { countryId: string; isAvailable: boolean };
            }
          ).some;
          rows = rows.filter((row) =>
            [...this.availability.values()].some(
              (availability) =>
                availability.serviceId === row.id &&
                availability.countryId === some.countryId &&
                availability.isAvailable === some.isAvailable,
            ),
          );
        }

        const ordered = rows.slice().sort((left, right) => {
          const leftCategory = this.categories.get(left.categoryId);
          const rightCategory = this.categories.get(right.categoryId);
          const leftOrder = leftCategory?.displayOrder ?? 0;
          const rightOrder = rightCategory?.displayOrder ?? 0;
          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
          }
          if (left.displayOrder !== right.displayOrder) {
            return left.displayOrder - right.displayOrder;
          }
          return left.id.localeCompare(right.id);
        });

        return this.applyCursorTake(ordered, args).map((row) =>
          this.hydrateService(row, args.include),
        );
      },
    ),
    aggregate: vi.fn(
      async ({ where }: { where?: { categoryId?: string } }) => {
        const rows = [...this.services.values()].filter((row) =>
          where?.categoryId === undefined
            ? true
            : row.categoryId === where.categoryId,
        );
        const orders = rows.map((row) => row.displayOrder);
        return {
          _max: {
            displayOrder: orders.length === 0 ? null : Math.max(...orders),
          },
        };
      },
    ),
    create: vi.fn(
      async ({
        data,
        include,
      }: {
        data: {
          categoryId: string;
          code: string;
          displayOrder: number;
          isActive: boolean;
          version: number;
          translations?: {
            create: Array<{
              locale: Locale;
              name: string | null;
              description: string | null;
            }>;
          };
        };
        include?: Parameters<CatalogMemoryDatabase["hydrateService"]>[1];
      }) => {
        if (this.forceUniqueConflict) {
          throw p2002();
        }
        const row: MemoryService = {
          id: this.id("svc"),
          categoryId: data.categoryId,
          code: data.code,
          displayOrder: data.displayOrder,
          isActive: data.isActive,
          version: data.version,
          createdAt: NOW,
          updatedAt: NOW,
        };
        this.services.set(row.id, row);
        for (const translation of data.translations?.create ?? []) {
          this.seedTranslation({
            serviceId: row.id,
            locale: translation.locale,
            name: translation.name,
            description: translation.description,
          });
        }
        return this.hydrateService(row, include);
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
        select?: { version?: true };
      }) => {
        if (this.forceUniqueConflict) {
          throw p2002();
        }
        const row = this.services.get(where.id);
        if (row === undefined) {
          throw new Error(`missing service ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        if (select?.version) {
          return { version: row.version };
        }
        return { ...row };
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (this.forceUniqueConflict) {
          throw p2002();
        }
        let count = 0;
        for (const row of this.services.values()) {
          if (matchesWhere(row as unknown as Record<string, unknown>, where)) {
            applyMutation(row as unknown as Record<string, unknown>, data);
            count += 1;
          }
        }
        return { count };
      },
    ),
  };

  readonly serviceTranslation = {
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { serviceId_locale: { serviceId: string; locale: Locale } };
        create: Omit<MemoryTranslation, "id">;
        update: { name: string | null; description: string | null };
      }) => {
        for (const row of this.translations.values()) {
          if (
            row.serviceId === where.serviceId_locale.serviceId &&
            row.locale === where.serviceId_locale.locale
          ) {
            row.name = update.name;
            row.description = update.description;
            return { ...row };
          }
        }
        return this.seedTranslation(create);
      },
    ),
  };

  readonly servicePriceUnit = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryPriceUnit, "id">;
      }) => {
        const row: MemoryPriceUnit = { id: this.id("unit"), ...data };
        this.priceUnits.set(row.id, row);
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
          throw new Error(`missing unit ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
  };

  readonly serviceField = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryField, "id">;
      }) => {
        const row: MemoryField = { id: this.id("field"), ...data };
        this.fields.set(row.id, row);
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
          throw new Error(`missing field ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
  };

  readonly serviceFieldOption = {
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryFieldOption, "id">;
      }) => {
        const row: MemoryFieldOption = { id: this.id("opt"), ...data };
        this.options.set(row.id, row);
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
        const row = this.options.get(where.id);
        if (row === undefined) {
          throw new Error(`missing option ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
  };

  readonly serviceCountryAvailability = {
    findMany: vi.fn(
      async ({
        where,
        include,
        orderBy,
      }: {
        where?: { serviceId?: string };
        include?: { country?: boolean };
        orderBy?: unknown;
      }) => {
        void orderBy;
        let rows = [...this.availability.values()];
        if (where?.serviceId !== undefined) {
          rows = rows.filter((row) => row.serviceId === where.serviceId);
        }
        rows = rows.slice().sort((left, right) => {
          const leftCode = this.countries.get(left.countryId)?.code ?? "";
          const rightCode = this.countries.get(right.countryId)?.code ?? "";
          return leftCode.localeCompare(rightCode);
        });
        return rows.map((row) => ({
          ...row,
          ...(include?.country
            ? {
                country: this.countries.get(row.countryId) ?? {
                  id: row.countryId,
                  code: "??",
                },
              }
            : {}),
        }));
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MemoryAvailability, "id">;
      }) => {
        const row: MemoryAvailability = { id: this.id("avail"), ...data };
        this.availability.set(row.id, row);
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
          throw new Error(`missing availability ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
  };

  readonly serviceMediaAssociation = {
    findMany: vi.fn(
      async ({
        where,
        include,
      }: {
        where?: { serviceId?: string };
        include?: { mediaFile?: { select?: unknown } };
      }) => {
        let rows = [...this.mediaAssociations.values()];
        if (where?.serviceId !== undefined) {
          rows = rows.filter((row) => row.serviceId === where.serviceId);
        }
        rows = sortByDisplayOrderThenId(rows);
        return rows.map((row) => ({
          ...row,
          ...(include?.mediaFile
            ? { mediaFile: this.mediaFiles.get(row.mediaFileId) }
            : {}),
        }));
      },
    ),
    aggregate: vi.fn(
      async ({ where }: { where?: { serviceId?: string } }) => {
        const rows = [...this.mediaAssociations.values()].filter((row) =>
          where?.serviceId === undefined
            ? true
            : row.serviceId === where.serviceId,
        );
        const orders = rows.map((row) => row.displayOrder);
        return {
          _max: {
            displayOrder: orders.length === 0 ? null : Math.max(...orders),
          },
        };
      },
    ),
    create: vi.fn(
      async ({
        data,
        include,
      }: {
        data: Omit<MemoryMediaAssociation, "id">;
        include?: { mediaFile?: { select?: unknown } };
      }) => {
        if (this.forceUniqueConflict) {
          throw p2002();
        }
        const row: MemoryMediaAssociation = {
          id: this.id("media-assoc"),
          ...data,
        };
        this.mediaAssociations.set(row.id, row);
        return {
          ...row,
          ...(include?.mediaFile
            ? { mediaFile: this.mediaFiles.get(row.mediaFileId) }
            : {}),
        };
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
        const row = this.mediaAssociations.get(where.id);
        if (row === undefined) {
          throw new Error(`missing media association ${where.id}`);
        }
        applyMutation(row as unknown as Record<string, unknown>, data);
        return { ...row };
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const row = this.mediaAssociations.get(where.id);
      if (row === undefined) {
        throw new Error(`missing media association ${where.id}`);
      }
      this.mediaAssociations.delete(where.id);
      return { ...row };
    }),
  };

  $executeRaw = vi.fn(async () => 1);

  $queryRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = Array.from(strings).join("?");
    if (sql.includes("service_media_associations")) {
      return [];
    }
    if (sql.includes("service_categories")) {
      return [...this.categories.values()]
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({ ...row }));
    }
    if (sql.includes("category_id")) {
      const categoryId = String(values[0]);
      return [...this.services.values()]
        .filter((row) => row.categoryId === categoryId)
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({ id: row.id }));
    }
    if (sql.includes("FROM services") && sql.includes("WHERE id")) {
      const serviceId = String(values[0]);
      const row = this.services.get(serviceId);
      return row === undefined ? [] : [{ id: row.id, version: row.version }];
    }
    return [];
  });

  $transaction = vi.fn(
    async <T>(
      work: (tx: CatalogMemoryDatabase) => Promise<T>,
      _options?: unknown,
    ): Promise<T> => work(this),
  );

  asClient(): CatalogMemoryDatabase {
    return this;
  }
}

function createRepository(db: CatalogMemoryDatabase): PrismaCatalogRepository {
  const createActiveCountryReader = vi.fn(() => ({
    requireActiveById: vi.fn(),
    requireActiveByCode: vi.fn(),
  }));
  const createPrivilegedAuditWriter = vi.fn(() => ({
    append: vi.fn(),
  }));
  const createCatalogServiceImageAuthorizer = vi.fn(() => ({
    authorize: vi.fn(),
  }));
  const createCatalogServiceMediaFactsReader = vi.fn(() => ({
    readCatalogServiceMediaFacts: vi.fn(async (mediaFileIds: readonly string[]) => {
      const facts = new Map<
        string,
        {
          mediaFileId: string;
          contentType: "image/jpeg" | "image/png" | "image/webp";
          width: number | null;
          height: number | null;
          status: string;
          ownerUserId: string;
        }
      >();
      for (const mediaFileId of mediaFileIds) {
        const row = db.mediaFiles.get(mediaFileId);
        if (row === undefined) {
          continue;
        }
        if (
          row.contentType === "image/jpeg" ||
          row.contentType === "image/png" ||
          row.contentType === "image/webp"
        ) {
          facts.set(mediaFileId, {
            mediaFileId,
            contentType: row.contentType,
            width: row.width,
            height: row.height,
            status: row.status,
            ownerUserId: row.ownerUserId,
          });
        }
      }
      return facts;
    }),
  }));
  return new PrismaCatalogRepository(
    db as never,
    createActiveCountryReader as never,
    createPrivilegedAuditWriter as never,
    createCatalogServiceImageAuthorizer as never,
    createCatalogServiceMediaFactsReader as never,
  );
}

describe("PrismaCatalogRepository in-memory coverage", () => {
  let db: CatalogMemoryDatabase;
  let repo: PrismaCatalogRepository;

  beforeEach(() => {
    db = new CatalogMemoryDatabase();
    repo = createRepository(db);
  });

  it("unitOfWork runInTransaction and runInReadSnapshot invoke factories and $transaction", async () => {
    const createActiveCountryReader = vi.fn(() => ({ tag: "country" }));
    const createPrivilegedAuditWriter = vi.fn(() => ({ tag: "audit" }));
    const createCatalogServiceImageAuthorizer = vi.fn(() => ({ tag: "media" }));
    const createCatalogServiceMediaFactsReader = vi.fn(() => ({
      tag: "mediaFacts",
      readCatalogServiceMediaFacts: vi.fn(async () => new Map()),
    }));
    const subject = new PrismaCatalogRepository(
      db as never,
      createActiveCountryReader as never,
      createPrivilegedAuditWriter as never,
      createCatalogServiceImageAuthorizer as never,
      createCatalogServiceMediaFactsReader as never,
    );

    const txResult = await subject.unitOfWork.runInTransaction(async (deps) => {
      expect(deps.tx).toBe(db);
      expect(deps.activeCountryReader).toEqual({ tag: "country" });
      expect(deps.privilegedAuditWriter).toEqual({ tag: "audit" });
      expect(deps.catalogServiceImageAuthorizer).toEqual({ tag: "media" });
      return "tx-ok";
    });
    expect(txResult).toBe("tx-ok");
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 30_000,
      timeout: 60_000,
    });

    const snapResult = await subject.unitOfWork.runInReadSnapshot(async () => "snap-ok");
    expect(snapResult).toBe("snap-ok");
    expect(db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 30_000,
      timeout: 60_000,
    });
    expect(createActiveCountryReader).toHaveBeenCalledTimes(2);
    expect(createPrivilegedAuditWriter).toHaveBeenCalledTimes(2);
    expect(createCatalogServiceImageAuthorizer).toHaveBeenCalledTimes(2);
  });

  it("acquireCatalogIdempotencyLock issues $executeRaw advisory lock", async () => {
    await acquireCatalogIdempotencyLock(db as never, "actor-1", "scope", "key");
    expect(db.$executeRaw).toHaveBeenCalled();
  });

  it("reserveOrReplayCommand covers proceed, replay, conflict, and pending create", async () => {
    await expect(
      repo.reserveOrReplayCommand(db as never, {
        scopeKey: "s",
        idempotencyKey: "k",
        requestHash: "h1",
        actorUserId: "u1",
        targetType: "CATEGORY",
      }),
    ).resolves.toBe("proceed");

    const pending = await repo.reserveOrReplayCommand(db as never, {
      scopeKey: "s2",
      idempotencyKey: "k2",
      requestHash: "h2",
      actorUserId: "u1",
      targetType: "SERVICE",
      pending: true,
      reservedMediaFileId: "media-1",
    });
    expect(pending).toMatchObject({
      status: "PENDING",
      replayed: false,
      reservedMediaFileId: "media-1",
    });

    await expect(
      repo.reserveOrReplayCommand(db as never, {
        scopeKey: "s2",
        idempotencyKey: "k2",
        requestHash: "h2",
        actorUserId: "u1",
        targetType: "SERVICE",
      }),
    ).resolves.toMatchObject({ status: "PENDING", replayed: true });

    await expect(
      repo.reserveOrReplayCommand(db as never, {
        scopeKey: "s2",
        idempotencyKey: "k2",
        requestHash: "different",
        actorUserId: "u1",
        targetType: "SERVICE",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_IDEMPOTENCY_CONFLICT" });
  });

  it("scopes idempotency receipts per trusted actor for the same scope/key", async () => {
    const scopeKey = "catalog:category.create:CATEGORY:*";
    const idempotencyKey = "shared-key";
    const requestHash = "e".repeat(64);

    const actorA = await repo.reserveOrReplayCommand(db as never, {
      scopeKey,
      idempotencyKey,
      requestHash,
      actorUserId: "staff-a",
      targetType: "CATEGORY",
      pending: true,
      reservedMediaFileId: "media-a",
    });
    const actorB = await repo.reserveOrReplayCommand(db as never, {
      scopeKey,
      idempotencyKey,
      requestHash,
      actorUserId: "staff-b",
      targetType: "CATEGORY",
      pending: true,
      reservedMediaFileId: "media-b",
    });

    expect(actorA).toMatchObject({ replayed: false, reservedMediaFileId: "media-a" });
    expect(actorB).toMatchObject({ replayed: false, reservedMediaFileId: "media-b" });
    if (actorA === "proceed" || actorB === "proceed") {
      throw new Error("Expected command receipts");
    }
    expect(actorA.id).not.toBe(actorB.id);
  });

  it("rejects PENDING reservations without a reserved media identity", async () => {
    await expect(
      repo.reserveOrReplayCommand(db as never, {
        scopeKey: "pending-scope",
        idempotencyKey: "pending-invalid",
        requestHash: "f".repeat(64),
        actorUserId: "u1",
        targetType: "SERVICE_MEDIA",
        pending: true,
        reservedMediaFileId: "",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_VALIDATION_FAILED" });
  });

  it("completeCommand creates, upgrades pending, replays completed, and rejects hash conflict", async () => {
    const created = await repo.completeCommand(db as never, {
      scopeKey: "s",
      idempotencyKey: "k",
      targetId: "t1",
      acceptedVersion: 2,
      actorUserId: "u1",
      requestHash: "h",
      targetType: "CATEGORY",
    });
    expect(created).toMatchObject({
      status: "COMPLETED",
      replayed: false,
      acceptedVersion: 2,
    });

    await expect(
      repo.completeCommand(db as never, {
        scopeKey: "s",
        idempotencyKey: "k",
        targetId: "t1",
        acceptedVersion: 2,
        actorUserId: "u1",
        requestHash: "h",
        targetType: "CATEGORY",
      }),
    ).resolves.toMatchObject({ status: "COMPLETED", replayed: true });

    await expect(
      repo.completeCommand(db as never, {
        scopeKey: "s",
        idempotencyKey: "k",
        targetId: "t1",
        acceptedVersion: 2,
        actorUserId: "u1",
        requestHash: "other",
        targetType: "CATEGORY",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_IDEMPOTENCY_CONFLICT" });

    await repo.reserveOrReplayCommand(db as never, {
      scopeKey: "pending-scope",
      idempotencyKey: "pending-key",
      requestHash: "ph",
      actorUserId: "u1",
      targetType: "SERVICE",
      pending: true,
      reservedMediaFileId: "media-reserved-1",
    });
    await expect(
      repo.completeCommand(db as never, {
        scopeKey: "pending-scope",
        idempotencyKey: "pending-key",
        targetId: "svc-1",
        acceptedVersion: 3,
        actorUserId: "u1",
        requestHash: "ph",
        targetType: "SERVICE",
      }),
    ).resolves.toMatchObject({
      status: "COMPLETED",
      replayed: false,
      acceptedVersion: 3,
      targetId: "svc-1",
    });
  });

  it("category find/list/nextDisplayOrder/insert/update and conflict paths", async () => {
    expect(await repo.findCategory(db as never, "missing")).toBeNull();
    expect(await repo.findCategoryByCode(db as never, "missing")).toBeNull();
    expect(await repo.lockCategory(db as never, "missing")).toBeNull();
    expect(await repo.nextCategoryDisplayOrder(db as never)).toBe(0);

    const inserted = await repo.insertCategory(db as never, {
      code: "HOME",
      displayOrder: 0,
      nameAr: "منزل",
      nameEn: "Home",
      descriptionAr: null,
      descriptionEn: null,
    });
    expect(inserted).toMatchObject({ code: "HOME", version: 1, isActive: false });
    expect(await repo.findCategoryByCode(db as never, "HOME")).toMatchObject({
      id: inserted.id,
    });
    expect(await repo.lockCategory(db as never, inserted.id)).toMatchObject({
      code: "HOME",
    });
    expect(await repo.nextCategoryDisplayOrder(db as never)).toBe(1);

    db.seedCategory({ id: "cat-b", code: "OFFICE", displayOrder: 1 });
    db.seedCategory({ id: "cat-c", code: "OTHER", displayOrder: 2 });
    const page = await repo.listCategories(db as never, { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(page.items[1]?.id);
    const page2 = await repo.listCategories(db as never, {
      cursor: page.nextCursor!,
      limit: 2,
    });
    expect(page2.items.length).toBeGreaterThan(0);
    expect(page2.nextCursor).toBeNull();

    const updated = await repo.updateCategory(db as never, {
      categoryId: inserted.id,
      expectedVersion: 1,
      content: {
        nameAr: "محدث",
        nameEn: "Updated",
        descriptionAr: "د",
        descriptionEn: "d",
      },
      isActive: true,
    });
    expect(updated).toMatchObject({ version: 2, isActive: true, nameEn: "Updated" });

    await expect(
      repo.updateCategory(db as never, {
        categoryId: inserted.id,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });

    db.forceUniqueConflict = true;
    await expect(
      repo.insertCategory(db as never, {
        code: "X",
        displayOrder: 9,
        nameAr: null,
        nameEn: null,
        descriptionAr: null,
        descriptionEn: null,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_CODE_CONFLICT" });
    db.forceUniqueConflict = false;

    db.hideCategoryAfterUpdate = true;
    db.categories.get(inserted.id)!.version = 2;
    await expect(
      repo.updateCategory(db as never, {
        categoryId: inserted.id,
        expectedVersion: 2,
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
  });

  it("service find/list/insert/update/translations and conflict paths", async () => {
    const category = db.seedCategory({ id: "cat-1", code: "HOME" });
    expect(await repo.findService(db as never, "missing")).toBeNull();
    expect(await repo.findServiceByCode(db as never, "missing")).toBeNull();
    expect(await repo.lockService(db as never, "missing")).toBeNull();
    expect(await repo.nextServiceDisplayOrder(db as never, category.id)).toBe(0);
    expect(await repo.bumpServiceVersions(db as never, [])).toBe(0);

    const created = await repo.insertService(db as never, {
      categoryId: category.id,
      code: "DEEP_CLEAN",
      displayOrder: 0,
      translations: [
        { locale: "EN", name: "Deep clean", description: null },
        { locale: "AR", name: "تنظيف", description: null },
      ],
    });
    expect(created.translations.map((row) => row.locale)).toEqual(["AR", "EN"]);
    expect(await repo.findServiceByCode(db as never, "DEEP_CLEAN")).toMatchObject({
      id: created.id,
    });
    expect(await repo.lockService(db as never, created.id)).toMatchObject({
      code: "DEEP_CLEAN",
    });
    expect(await repo.nextServiceDisplayOrder(db as never, category.id)).toBe(1);

    db.seedService({ id: "svc-b", categoryId: category.id, code: "B", displayOrder: 1 });
    db.seedService({ id: "svc-c", categoryId: category.id, code: "C", displayOrder: 2 });
    const page = await repo.listServices(db as never, {
      categoryId: category.id,
      limit: 2,
    });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
    const all = await repo.listServices(db as never, { limit: 50 });
    expect(all.items.length).toBeGreaterThanOrEqual(3);

    await repo.upsertServiceTranslations(db as never, created.id, [
      { locale: "EN", name: "Updated EN", description: "d" },
      { locale: "AR", name: "محدث", description: null },
    ]);
    expect(
      (await repo.findService(db as never, created.id))?.translations.find(
        (row) => row.locale === "EN",
      )?.name,
    ).toBe("Updated EN");

    const moved = await repo.updateService(db as never, {
      serviceId: created.id,
      expectedVersion: 1,
      categoryId: category.id,
      displayOrder: 5,
      isActive: true,
    });
    expect(moved).toMatchObject({ version: 2, displayOrder: 5, isActive: true });

    await expect(
      repo.updateService(db as never, {
        serviceId: created.id,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });

    db.forceUniqueConflict = true;
    await expect(
      repo.insertService(db as never, {
        categoryId: category.id,
        code: "X",
        displayOrder: 9,
        translations: [],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_CODE_CONFLICT" });

    db.services.get(created.id)!.version = 2;
    await expect(
      repo.updateService(db as never, {
        serviceId: created.id,
        expectedVersion: 2,
        categoryId: category.id,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_CODE_CONFLICT" });
    db.forceUniqueConflict = false;

    db.hideServiceAfterUpdate = true;
    db.services.get(created.id)!.version = 2;
    await expect(
      repo.updateService(db as never, {
        serviceId: created.id,
        expectedVersion: 2,
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });
    db.hideServiceAfterUpdate = false;

    expect(await repo.lockChildServiceIds(db as never, category.id)).toEqual(
      expect.arrayContaining([created.id, "svc-b", "svc-c"]),
    );
    expect(await repo.bumpServiceVersions(db as never, [created.id, "svc-b"])).toBe(2);
  });

  it("findServiceWithConfiguration and replaceServiceConfiguration happy + error paths", async () => {
    const category = db.seedCategory({ id: "cat-1", code: "HOME" });
    const service = db.seedService({
      id: "svc-1",
      categoryId: category.id,
      code: "CLEAN",
      version: 1,
    });
    db.seedTranslation({
      serviceId: service.id,
      locale: "EN",
      name: "Clean",
      description: null,
    });

    const existingUnit: MemoryPriceUnit = {
      id: "unit-1",
      serviceId: service.id,
      code: "PER_VISIT",
      labelAr: null,
      labelEn: "Visit",
      displayOrder: 0,
      isActive: true,
    };
    db.priceUnits.set(existingUnit.id, existingUnit);
    const omitUnit: MemoryPriceUnit = {
      id: "unit-2",
      serviceId: service.id,
      code: "PER_HOUR",
      labelAr: null,
      labelEn: "Hour",
      displayOrder: 1,
      isActive: true,
    };
    db.priceUnits.set(omitUnit.id, omitUnit);

    const existingField: MemoryField = {
      id: "field-1",
      serviceId: service.id,
      code: "ROOMS",
      kind: "NUMBER",
      labelAr: null,
      labelEn: "Rooms",
      helpTextAr: null,
      helpTextEn: null,
      isRequired: true,
      isActive: true,
      minLength: null,
      maxLength: null,
      numberMode: "INTEGER",
      minValue: new Prisma.Decimal("10"),
      maxValue: new Prisma.Decimal("10.500"),
      minSelections: null,
      maxSelections: null,
      displayOrder: 0,
    };
    db.fields.set(existingField.id, existingField);
    const omitField: MemoryField = {
      id: "field-2",
      serviceId: service.id,
      code: "NOTES",
      kind: "TEXT",
      labelAr: null,
      labelEn: "Notes",
      helpTextAr: null,
      helpTextEn: null,
      isRequired: false,
      isActive: true,
      minLength: null,
      maxLength: 100,
      numberMode: null,
      minValue: null,
      maxValue: null,
      minSelections: null,
      maxSelections: null,
      displayOrder: 1,
    };
    db.fields.set(omitField.id, omitField);

    const keepOption: MemoryFieldOption = {
      id: "opt-1",
      serviceFieldId: existingField.id,
      value: "A",
      labelAr: null,
      labelEn: "A",
      displayOrder: 0,
      isActive: true,
    };
    db.options.set(keepOption.id, keepOption);
    const omitOption: MemoryFieldOption = {
      id: "opt-2",
      serviceFieldId: existingField.id,
      value: "B",
      labelAr: null,
      labelEn: "B",
      displayOrder: 1,
      isActive: true,
    };
    db.options.set(omitOption.id, omitOption);

    const configured = await repo.findServiceWithConfiguration(db as never, service.id);
    expect(configured?.fields[0]?.minValue).toBe("10");
    expect(configured?.fields[0]?.maxValue).toBe("10.5");
    expect(await repo.findServiceWithConfiguration(db as never, "missing")).toBeNull();

    const replaced = await repo.replaceServiceConfiguration(db as never, {
      serviceId: service.id,
      expectedVersion: 1,
      translations: [{ locale: "EN", name: "Cleaner", description: "d" }],
      priceUnits: [
        {
          code: "PER_VISIT",
          labelAr: null,
          labelEn: "Visit updated",
          isActive: true,
        },
        {
          code: "PER_ROOM",
          labelAr: null,
          labelEn: "Room",
          isActive: true,
        },
      ],
      fields: [
        {
          code: "ROOMS",
          kind: "SINGLE_SELECT",
          labelAr: null,
          labelEn: "Rooms",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: true,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          options: [
            { value: "A", labelAr: null, labelEn: "A+", isActive: true },
            { value: "C", labelAr: null, labelEn: "C", isActive: true },
          ],
        },
        {
          code: "PETS",
          kind: "BOOLEAN",
          labelAr: null,
          labelEn: "Pets",
          helpTextAr: null,
          helpTextEn: null,
          isRequired: false,
          isActive: true,
          minLength: null,
          maxLength: null,
          numberMode: null,
          minValue: null,
          maxValue: null,
          minSelections: null,
          maxSelections: null,
          options: [],
        },
      ],
    });

    expect(replaced.version).toBe(2);
    expect(replaced.priceUnits.map((unit) => unit.code)).toEqual([
      "PER_VISIT",
      "PER_ROOM",
      "PER_HOUR",
    ]);
    expect(replaced.priceUnits.find((unit) => unit.code === "PER_HOUR")?.isActive).toBe(
      false,
    );
    expect(replaced.fields.map((field) => field.code)).toEqual([
      "ROOMS",
      "PETS",
      "NOTES",
    ]);
    expect(replaced.fields.find((field) => field.code === "NOTES")?.isActive).toBe(
      false,
    );
    const rooms = replaced.fields.find((field) => field.code === "ROOMS");
    expect(rooms?.options.map((option) => option.value)).toEqual(["A", "C", "B"]);
    expect(rooms?.options.find((option) => option.value === "B")?.isActive).toBe(false);

    await expect(
      repo.replaceServiceConfiguration(db as never, {
        serviceId: "missing",
        expectedVersion: 1,
        translations: [],
        priceUnits: [],
        fields: [],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });

    await expect(
      repo.replaceServiceConfiguration(db as never, {
        serviceId: service.id,
        expectedVersion: 99,
        translations: [],
        priceUnits: [],
        fields: [],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
  });

  it("category and service order replace empty and reorder paths", async () => {
    expect(await repo.lockAllCategories(db as never)).toEqual([]);
    expect(
      await repo.replaceCategoryOrder(db as never, { orderedIds: [], positions: [] }),
    ).toEqual([]);

    db.seedCategory({ id: "cat-a", code: "A", displayOrder: 0, version: 1 });
    db.seedCategory({ id: "cat-b", code: "B", displayOrder: 1, version: 1 });
    db.seedService({ id: "svc-a", categoryId: "cat-a", code: "SA", displayOrder: 0 });
    db.seedService({ id: "svc-b", categoryId: "cat-a", code: "SB", displayOrder: 1 });

    const reorderedCategories = await repo.replaceCategoryOrder(db as never, {
      orderedIds: ["cat-b", "cat-a"],
      positions: [0, 1],
    });
    expect(reorderedCategories.map((row) => row.id)).toEqual(["cat-a", "cat-b"]);
    expect(db.categories.get("cat-b")?.displayOrder).toBe(0);
    expect(db.categories.get("cat-a")?.displayOrder).toBe(1);
    expect(db.services.get("svc-a")?.version).toBe(2);

    expect(await repo.lockServicesInCategory(db as never, "cat-empty")).toEqual([]);
    expect(
      await repo.replaceServiceOrder(db as never, {
        categoryId: "cat-empty",
        orderedIds: [],
        positions: [],
      }),
    ).toEqual([]);

    const reorderedServices = await repo.replaceServiceOrder(db as never, {
      categoryId: "cat-a",
      orderedIds: ["svc-b", "svc-a"],
      positions: [0, 1],
    });
    expect(reorderedServices.map((row) => row.id)).toEqual(
      expect.arrayContaining(["svc-a", "svc-b"]),
    );
    expect(db.services.get("svc-b")?.displayOrder).toBe(0);
    expect(db.services.get("svc-a")?.displayOrder).toBe(1);
  });

  it("country availability list/replace create update omit and version conflicts", async () => {
    const category = db.seedCategory({ id: "cat-1", code: "HOME" });
    const service = db.seedService({
      id: "svc-1",
      categoryId: category.id,
      code: "CLEAN",
      version: 1,
    });
    db.seedCountry("eg", "EG");
    db.seedCountry("sa", "SA");
    db.availability.set("avail-1", {
      id: "avail-1",
      serviceId: service.id,
      countryId: "eg",
      isAvailable: true,
    });
    db.availability.set("avail-2", {
      id: "avail-2",
      serviceId: service.id,
      countryId: "sa",
      isAvailable: true,
    });

    const listed = await repo.listServiceCountryAvailability(db as never, service.id);
    expect(listed.map((row) => row.countryCode)).toEqual(["EG", "SA"]);

    const replaced = await repo.replaceServiceCountryAvailability(db as never, {
      serviceId: service.id,
      expectedVersion: 1,
      countries: [
        { countryId: "eg", countryCode: "EG", isAvailable: false },
        { countryId: "ae", countryCode: "AE", isAvailable: true },
      ],
    });
    expect(replaced.version).toBe(2);
    expect(db.availability.get("avail-1")?.isAvailable).toBe(false);
    expect(db.availability.get("avail-2")?.isAvailable).toBe(false);
    expect(
      [...db.availability.values()].some(
        (row) => row.countryId === "ae" && row.isAvailable,
      ),
    ).toBe(true);

    await expect(
      repo.replaceServiceCountryAvailability(db as never, {
        serviceId: "missing",
        expectedVersion: 1,
        countries: [],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });

    await expect(
      repo.replaceServiceCountryAvailability(db as never, {
        serviceId: service.id,
        expectedVersion: 1,
        countries: [],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_VERSION_CONFLICT" });
  });

  it("selectable service candidates pagination and find by code", async () => {
    const category = db.seedCategory({
      id: "cat-1",
      code: "HOME",
      isActive: true,
      displayOrder: 0,
    });
    db.seedCountry("eg", "EG");
    for (const [id, order] of [
      ["svc-1", 0],
      ["svc-2", 1],
      ["svc-3", 2],
    ] as const) {
      db.seedService({
        id,
        categoryId: category.id,
        code: id.toUpperCase(),
        displayOrder: order,
        isActive: true,
      });
      db.availability.set(`avail-${id}`, {
        id: `avail-${id}`,
        serviceId: id,
        countryId: "eg",
        isAvailable: true,
      });
    }

    const page = await repo.listSelectableServiceCandidates(db as never, {
      countryId: "eg",
      limit: 2,
    });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(page.items[1]?.service.id);
    expect(page.items[0]?.countryAvailabilityIsAvailable).toBe(true);

    const page2 = await repo.listSelectableServiceCandidates(db as never, {
      countryId: "eg",
      cursor: page.nextCursor!,
      limit: 2,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    expect(
      await repo.findSelectableServiceByCode(db as never, {
        serviceCode: "missing",
        countryId: "eg",
      }),
    ).toBeNull();

    const found = await repo.findSelectableServiceByCode(db as never, {
      serviceCode: "SVC-1",
      countryId: "eg",
    });
    expect(found).toMatchObject({
      service: { code: "SVC-1" },
      countryAvailabilityIsAvailable: true,
    });

    const withoutAvailability = await repo.findSelectableServiceByCode(db as never, {
      serviceCode: "SVC-1",
      countryId: "sa",
    });
    expect(withoutAvailability?.countryAvailabilityIsAvailable).toBe(false);
  });

  it("media associations list/lock/insert/reorder/remove and contentType branches", async () => {
    const category = db.seedCategory({ id: "cat-1", code: "HOME" });
    const service = db.seedService({
      id: "svc-1",
      categoryId: category.id,
      code: "CLEAN",
      version: 1,
    });
    db.seedMediaFile({ id: "media-jpeg", contentType: "image/jpeg" });
    db.seedMediaFile({ id: "media-png", contentType: "image/png" });
    db.seedMediaFile({ id: "media-webp", contentType: "image/webp" });
    db.seedMediaFile({ id: "media-gif", contentType: "image/gif" });

    expect(await repo.nextServiceMediaDisplayOrder(db as never, service.id)).toBe(0);
    expect(await repo.listServiceMediaAssociations(db as never, service.id)).toEqual([]);

    const jpeg = await repo.insertServiceMediaAssociation(db as never, {
      serviceId: service.id,
      mediaFileId: "media-jpeg",
    });
    expect(jpeg.contentType).toBe("image/jpeg");
    expect(jpeg.displayOrder).toBe(0);

    const png = await repo.insertServiceMediaAssociation(db as never, {
      serviceId: service.id,
      mediaFileId: "media-png",
      displayOrder: 1,
    });
    expect(png.contentType).toBe("image/png");

    const webp = await repo.insertServiceMediaAssociation(db as never, {
      serviceId: service.id,
      mediaFileId: "media-webp",
    });
    expect(webp.contentType).toBe("image/webp");

    const gif = await repo.insertServiceMediaAssociation(db as never, {
      serviceId: service.id,
      mediaFileId: "media-gif",
    });
    expect(gif.contentType).toBeUndefined();
    expect(gif.width).toBeUndefined();

    const locked = await repo.lockServiceMediaAssociations(db as never, service.id);
    expect(locked).toHaveLength(4);

    await expect(
      repo.replaceServiceMediaOrder(db as never, {
        serviceId: service.id,
        orderedAssociationIds: [jpeg.id],
      }),
    ).rejects.toMatchObject({ code: "CATALOG_ORDER_INVALID" });

    const reordered = await repo.replaceServiceMediaOrder(db as never, {
      serviceId: service.id,
      orderedAssociationIds: [gif.id, webp.id, png.id, jpeg.id],
    });
    expect(reordered.map((row) => row.id)).toEqual([
      gif.id,
      webp.id,
      png.id,
      jpeg.id,
    ]);

    db.forceUniqueConflict = true;
    await expect(
      repo.insertServiceMediaAssociation(db as never, {
        serviceId: service.id,
        mediaFileId: "media-jpeg",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_MEDIA_INVALID" });
    db.forceUniqueConflict = false;

    await expect(
      repo.removeServiceMediaAssociation(db as never, {
        serviceId: service.id,
        associationId: "missing",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_NOT_FOUND" });

    await repo.removeServiceMediaAssociation(db as never, {
      serviceId: service.id,
      associationId: gif.id,
    });
    const remaining = await repo.listServiceMediaAssociations(db as never, service.id);
    expect(remaining.map((row) => row.id)).toEqual([webp.id, png.id, jpeg.id]);
    expect(remaining.map((row) => row.displayOrder)).toEqual([0, 1, 2]);

    expect(await repo.bumpServiceVersion(db as never, service.id)).toBe(2);
  });
});
