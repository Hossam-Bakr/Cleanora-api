/**
 * Catalog repository and Prisma unit of work.
 * CatalogService / PrismaCatalogRepository own Catalog transactions.
 */
 
import type { PrivilegedAuditWriter } from "#modules/admin/audit.public";
import type { ActiveCountryReader } from "#modules/configuration/configuration.public";
import type {
  CatalogServiceMediaSafeFact,
  TransactionalCatalogServiceImageAuthorizer,
  TransactionalCatalogServiceMediaFactsReader,
} from "#modules/media/media.public";
import { getPrismaClient } from "#database/prisma";
import { Prisma, type PrismaClient } from "#generated/prisma/client";
import { CatalogError } from "./catalog.errors.js";
import { catalogAdvisoryLockKey, type CatalogLocaleCode } from "./catalog.policy.js";
 
export type CatalogTransactionClient = Prisma.TransactionClient;
 
export interface CatalogCommandReceipt {
  readonly id: string;
  readonly status: "PENDING" | "COMPLETED";
  readonly targetType: string;
  readonly targetId: string | null;
  readonly acceptedVersion: number | null;
  readonly replayed: boolean;
  readonly reservedMediaFileId?: string | null;
}
 
export interface CatalogServiceMediaAssociationRow {
  readonly id: string;
  readonly serviceId: string;
  readonly mediaFileId: string;
  readonly displayOrder: number;
  readonly contentType?: "image/jpeg" | "image/png" | "image/webp";
  readonly width?: number | null;
  readonly height?: number | null;
  readonly status?: string;
  readonly ownerUserId?: string;
  readonly storageKey?: string;
}
 
export interface CatalogIdempotencyLookup {
  readonly scopeKey: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly actorUserId: string;
  readonly targetType: string;
}
 
export interface CatalogCategoryRow {
  readonly id: string;
  readonly code: string;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
 
export interface CatalogServiceTranslationRow {
  readonly locale: CatalogLocaleCode;
  readonly name: string | null;
  readonly description: string | null;
}
 
export interface CatalogServiceRow {
  readonly id: string;
  readonly categoryId: string;
  readonly code: string;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly translations: readonly CatalogServiceTranslationRow[];
}
 
export interface CatalogPriceUnitRow {
  readonly id: string;
  readonly code: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}
 
export interface CatalogServiceFieldOptionRow {
  readonly id: string;
  readonly value: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}
 
export interface CatalogServiceFieldRow {
  readonly id: string;
  readonly code: string;
  readonly kind:
    | "INFORMATION"
    | "TEXT"
    | "NUMBER"
    | "BOOLEAN"
    | "SINGLE_SELECT"
    | "MULTI_SELECT";
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly numberMode: "INTEGER" | "DECIMAL" | null;
  readonly minValue: string | null;
  readonly maxValue: string | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly displayOrder: number;
  readonly options: readonly CatalogServiceFieldOptionRow[];
}
 
export interface CatalogServiceWithConfigurationRow extends CatalogServiceRow {
  readonly priceUnits: readonly CatalogPriceUnitRow[];
  readonly fields: readonly CatalogServiceFieldRow[];
}
 
export interface CatalogServiceCountryAvailabilityRow {
  readonly id: string;
  readonly countryId: string;
  readonly countryCode: string;
  readonly isAvailable: boolean;
}
 
export interface SelectableServiceCandidateRow {
  readonly category: CatalogCategoryRow;
  readonly service: CatalogServiceWithConfigurationRow;
  readonly countryAvailabilityIsAvailable: boolean;
}
 
export interface CatalogOrderIdentitySnapshot {
  readonly id: string;
  readonly version: number;
  readonly displayOrder: number;
}
 
export interface CatalogServiceConfigurationReplacementInput {
  readonly serviceId: string;
  readonly expectedVersion: number;
  readonly translations: readonly CatalogServiceTranslationRow[];
  readonly priceUnits: readonly {
    readonly code: string;
    readonly labelAr: string | null;
    readonly labelEn: string | null;
    readonly isActive: boolean;
  }[];
  readonly fields: readonly {
    readonly code: string;
    readonly kind: CatalogServiceFieldRow["kind"];
    readonly labelAr: string | null;
    readonly labelEn: string | null;
    readonly helpTextAr: string | null;
    readonly helpTextEn: string | null;
    readonly isRequired: boolean;
    readonly isActive: boolean;
    readonly minLength: number | null;
    readonly maxLength: number | null;
    readonly numberMode: "INTEGER" | "DECIMAL" | null;
    readonly minValue: string | null;
    readonly maxValue: string | null;
    readonly minSelections: number | null;
    readonly maxSelections: number | null;
    readonly options: readonly {
      readonly value: string;
      readonly labelAr: string | null;
      readonly labelEn: string | null;
      readonly isActive: boolean;
    }[];
  }[];
}
 
export interface CatalogUnitOfWorkDependencies {
  readonly activeCountryReader: ActiveCountryReader;
  readonly privilegedAuditWriter: PrivilegedAuditWriter;
  readonly catalogServiceImageAuthorizer: TransactionalCatalogServiceImageAuthorizer;
  readonly tx: CatalogTransactionClient;
}
 
export interface CatalogUnitOfWork {
  runInTransaction<T>(
    work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
  ): Promise<T>;
  runInReadSnapshot<T>(
    work: (deps: CatalogUnitOfWorkDependencies) => Promise<T>,
  ): Promise<T>;
  /**
   * Bind Catalog collaborators to an opaque shared transaction without opening
   * a nested Catalog-owned transaction.
   */
  bindToTransaction(transactionContext: unknown): CatalogUnitOfWorkDependencies;
}
 
export interface CatalogPage<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: string | null;
}
 
export interface CatalogCursorQueryInput {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}
 
export interface CatalogCategoryContentInput {
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
}
 
export interface CatalogRepository {
  readonly unitOfWork: CatalogUnitOfWork;
  reserveOrReplayCommand(
    tx: CatalogTransactionClient,
    input: CatalogReserveOrReplayInput,
  ): Promise<CatalogCommandReceipt | "proceed">;
  completeCommand(
    tx: CatalogTransactionClient,
    input: {
      readonly scopeKey: string;
      readonly idempotencyKey: string;
      readonly targetId: string;
      readonly acceptedVersion: number;
      readonly actorUserId: string;
      readonly requestHash: string;
      readonly targetType: string;
    },
  ): Promise<CatalogCommandReceipt>;
  lockCategory(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<CatalogCategoryRow | null>;
  findCategory(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<CatalogCategoryRow | null>;
  findCategoryByCode(
    tx: CatalogTransactionClient,
    code: string,
  ): Promise<CatalogCategoryRow | null>;
  listCategories(
    tx: CatalogTransactionClient,
    query: CatalogCursorQueryInput,
  ): Promise<CatalogPage<CatalogCategoryRow>>;
  nextCategoryDisplayOrder(tx: CatalogTransactionClient): Promise<number>;
  insertCategory(
    tx: CatalogTransactionClient,
    input: CatalogCategoryContentInput & {
      readonly code: string;
      readonly displayOrder: number;
    },
  ): Promise<CatalogCategoryRow>;
  updateCategory(
    tx: CatalogTransactionClient,
    input: {
      readonly categoryId: string;
      readonly expectedVersion: number;
      readonly content?: CatalogCategoryContentInput;
      readonly isActive?: boolean;
    },
  ): Promise<CatalogCategoryRow>;
  lockChildServiceIds(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<readonly string[]>;
  bumpServiceVersions(
    tx: CatalogTransactionClient,
    serviceIds: readonly string[],
  ): Promise<number>;
  lockService(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<CatalogServiceRow | null>;
  findService(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<CatalogServiceRow | null>;
  findServiceByCode(
    tx: CatalogTransactionClient,
    code: string,
  ): Promise<CatalogServiceRow | null>;
  listServices(
    tx: CatalogTransactionClient,
    query: CatalogCursorQueryInput & { readonly categoryId?: string | undefined },
  ): Promise<CatalogPage<CatalogServiceRow>>;
  nextServiceDisplayOrder(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<number>;
  insertService(
    tx: CatalogTransactionClient,
    input: {
      readonly categoryId: string;
      readonly code: string;
      readonly displayOrder: number;
      readonly translations: readonly CatalogServiceTranslationRow[];
    },
  ): Promise<CatalogServiceRow>;
  updateService(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly expectedVersion: number;
      readonly categoryId?: string;
      readonly displayOrder?: number;
      readonly isActive?: boolean;
    },
  ): Promise<CatalogServiceRow>;
  upsertServiceTranslations(
    tx: CatalogTransactionClient,
    serviceId: string,
    translations: readonly CatalogServiceTranslationRow[],
  ): Promise<void>;
  findServiceWithConfiguration(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<CatalogServiceWithConfigurationRow | null>;
  replaceServiceConfiguration(
    tx: CatalogTransactionClient,
    input: CatalogServiceConfigurationReplacementInput,
  ): Promise<CatalogServiceWithConfigurationRow>;
  lockAllCategories(tx: CatalogTransactionClient): Promise<readonly CatalogCategoryRow[]>;
  replaceCategoryOrder(
    tx: CatalogTransactionClient,
    input: {
      readonly orderedIds: readonly string[];
      readonly positions: readonly number[];
    },
  ): Promise<readonly CatalogCategoryRow[]>;
  lockServicesInCategory(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<readonly CatalogServiceRow[]>;
  replaceServiceOrder(
    tx: CatalogTransactionClient,
    input: {
      readonly categoryId: string;
      readonly orderedIds: readonly string[];
      readonly positions: readonly number[];
    },
  ): Promise<readonly CatalogServiceRow[]>;
  listServiceCountryAvailability(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<readonly CatalogServiceCountryAvailabilityRow[]>;
  replaceServiceCountryAvailability(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly expectedVersion: number;
      readonly countries: readonly {
        readonly countryId: string;
        readonly countryCode: string;
        readonly isAvailable: boolean;
      }[];
    },
  ): Promise<CatalogServiceWithConfigurationRow>;
  listSelectableServiceCandidates(
    tx: CatalogTransactionClient,
    input: {
      readonly countryId: string;
      readonly cursor?: string | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<CatalogPage<SelectableServiceCandidateRow>>;
  findSelectableServiceByCode(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceCode: string;
      readonly countryId: string;
    },
  ): Promise<SelectableServiceCandidateRow | null>;
  findSelectableServiceById(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly countryId: string;
    },
  ): Promise<SelectableServiceCandidateRow | null>;
  listServiceMediaAssociations(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<readonly CatalogServiceMediaAssociationRow[]>;
  lockServiceMediaAssociations(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<readonly CatalogServiceMediaAssociationRow[]>;
  insertServiceMediaAssociation(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly mediaFileId: string;
      readonly displayOrder?: number;
    },
  ): Promise<CatalogServiceMediaAssociationRow>;
  replaceServiceMediaOrder(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly orderedAssociationIds: readonly string[];
    },
  ): Promise<readonly CatalogServiceMediaAssociationRow[]>;
  removeServiceMediaAssociation(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly associationId: string;
    },
  ): Promise<void>;
  nextServiceMediaDisplayOrder(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<number>;
  bumpServiceVersion(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<number>;
}
 
export type CreateActiveCountryReaderFactory = (
  transaction: unknown,
) => ActiveCountryReader;
 
export type CreatePrivilegedAuditWriterFactory = (
  transaction: Pick<Prisma.TransactionClient, "auditLog">,
) => PrivilegedAuditWriter;
 
export type CreateCatalogServiceImageAuthorizerFactory = (
  transaction: unknown,
) => TransactionalCatalogServiceImageAuthorizer;

export type CreateCatalogServiceMediaFactsReaderFactory = (
  transaction: unknown,
) => TransactionalCatalogServiceMediaFactsReader;

export type CatalogReserveOrReplayInput = CatalogIdempotencyLookup &
  (
    | {
        readonly targetId?: string | null;
        readonly pending?: false | undefined;
        readonly reservedMediaFileId?: string | null;
      }
    | {
        readonly targetId?: string | null;
        readonly pending: true;
        readonly reservedMediaFileId: string;
      }
  );

const DEFAULT_PAGE_LIMIT = 50;

const CATALOG_UNIT_OF_WORK_TRANSACTION_OPTIONS = {
  maxWait: 30_000,
  timeout: 60_000,
} as const;
 
type ServiceWithTranslations = Prisma.ServiceGetPayload<{
  include: { translations: true };
}>;
 
type ServiceWithConfiguration = Prisma.ServiceGetPayload<{
  include: {
    translations: true;
    priceUnits: true;
    fields: { include: { options: true } };
  };
}>;
 
/**
 * Advisory-lock helper keyed by Catalog idempotency identity.
 */
export async function acquireCatalogIdempotencyLock(
  tx: CatalogTransactionClient,
  actorUserId: string,
  scopeKey: string,
  idempotencyKey: string,
): Promise<void> {
  const { classId, objectId } = catalogAdvisoryLockKey(
    actorUserId,
    scopeKey,
    idempotencyKey,
  );
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(${classId}, ${objectId})
  `;
}

function catalogCommandLookupWhere(input: {
  readonly actorUserId: string;
  readonly scopeKey: string;
  readonly idempotencyKey: string;
}) {
  return {
    actorUserId_scopeKey_idempotencyKey: {
      actorUserId: input.actorUserId,
      scopeKey: input.scopeKey,
      idempotencyKey: input.idempotencyKey,
    },
  };
}

function mapMediaFactToAssociationFields(
  fact: CatalogServiceMediaSafeFact | undefined,
): Pick<
  CatalogServiceMediaAssociationRow,
  "contentType" | "width" | "height" | "status" | "ownerUserId"
> {
  if (fact === undefined) {
    return {};
  }
  return {
    contentType: fact.contentType,
    width: fact.width,
    height: fact.height,
    status: fact.status,
    ownerUserId: fact.ownerUserId,
  };
}
 
function resolvePageLimit(limit: number | undefined): number {
  return limit ?? DEFAULT_PAGE_LIMIT;
}
 
function buildCursorArgs(cursor: string | undefined): {
  cursor?: { id: string };
  skip?: number;
} {
  if (cursor === undefined) {
    return {};
  }
  return { cursor: { id: cursor }, skip: 1 };
}
 
function mapCategory(row: {
  readonly id: string;
  readonly code: string;
  readonly nameAr: string | null;
  readonly nameEn: string | null;
  readonly descriptionAr: string | null;
  readonly descriptionEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): CatalogCategoryRow {
  return {
    id: row.id,
    code: row.code,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
 
function compareByDisplayOrderThenId(
  left: { readonly displayOrder: number; readonly id: string },
  right: { readonly displayOrder: number; readonly id: string },
): number {
  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }
  return left.id.localeCompare(right.id);
}
 
function compareTranslationsByLocale(
  left: { readonly locale: string },
  right: { readonly locale: string },
): number {
  return left.locale.localeCompare(right.locale);
}
 
/**
 * @desc Choose a non-negative temporary display-order base that cannot collide
 *   with final contiguous positions `0..finalCount-1` or existing orders.
 * @explanation Unique `(parent, display_order)` indexes require parking every
 *   existing sibling before reassignment; CHECK constraints forbid negatives.
 */
function temporaryDisplayOrderBase(
  existingOrders: readonly number[],
  finalCount: number,
): number {
  const maxExisting =
    existingOrders.length === 0
      ? -1
      : existingOrders.reduce((max, order) => Math.max(max, order), -1);
  return Math.max(maxExisting + 1, finalCount);
}
 
function mapService(row: ServiceWithTranslations): CatalogServiceRow {
  return {
    id: row.id,
    categoryId: row.categoryId,
    code: row.code,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    translations: row.translations
      .slice()
      .sort(compareTranslationsByLocale)
      .map((translation) => ({
        locale: translation.locale,
        name: translation.name,
        description: translation.description,
      })),
  };
}
 
function decimalToString(value: Prisma.Decimal | null): string | null {
  if (value === null) {
    return null;
  }
  const text = value.toString();
  if (!text.includes(".")) {
    return text;
  }
  return text.replace(/\.?0+$/u, "");
}
 
function mapServiceFieldOption(row: {
  readonly id: string;
  readonly value: string;
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}): CatalogServiceFieldOptionRow {
  return {
    id: row.id,
    value: row.value,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
  };
}
 
function mapServiceField(row: {
  readonly id: string;
  readonly code: string;
  readonly kind: CatalogServiceFieldRow["kind"];
  readonly labelAr: string | null;
  readonly labelEn: string | null;
  readonly helpTextAr: string | null;
  readonly helpTextEn: string | null;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly numberMode: "INTEGER" | "DECIMAL" | null;
  readonly minValue: Prisma.Decimal | null;
  readonly maxValue: Prisma.Decimal | null;
  readonly minSelections: number | null;
  readonly maxSelections: number | null;
  readonly displayOrder: number;
  readonly options: readonly {
    readonly id: string;
    readonly value: string;
    readonly labelAr: string | null;
    readonly labelEn: string | null;
    readonly displayOrder: number;
    readonly isActive: boolean;
  }[];
}): CatalogServiceFieldRow {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    helpTextAr: row.helpTextAr,
    helpTextEn: row.helpTextEn,
    isRequired: row.isRequired,
    isActive: row.isActive,
    minLength: row.minLength,
    maxLength: row.maxLength,
    numberMode: row.numberMode,
    minValue: decimalToString(row.minValue),
    maxValue: decimalToString(row.maxValue),
    minSelections: row.minSelections,
    maxSelections: row.maxSelections,
    displayOrder: row.displayOrder,
    options: row.options
      .slice()
      .sort(compareByDisplayOrderThenId)
      .map(mapServiceFieldOption),
  };
}
 
function mapServiceWithConfiguration(
  row: ServiceWithConfiguration,
): CatalogServiceWithConfigurationRow {
  const base = mapService(row);
  return {
    ...base,
    priceUnits: row.priceUnits
      .slice()
      .sort(compareByDisplayOrderThenId)
      .map((unit) => ({
        id: unit.id,
        code: unit.code,
        labelAr: unit.labelAr,
        labelEn: unit.labelEn,
        displayOrder: unit.displayOrder,
        isActive: unit.isActive,
      })),
    fields: row.fields
      .slice()
      .sort(compareByDisplayOrderThenId)
      .map(mapServiceField),
  };
}
 
function mapUniqueConflict(error: unknown, codeField: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new CatalogError(
      "CATALOG_CODE_CONFLICT",
      "Catalog stable identity or order conflicts with an existing row",
      { details: { field: codeField } },
    );
  }
  throw error;
}
 
function throwCategoryVersionConflict(expectedVersion: number): never {
  throw new CatalogError(
    "CATALOG_VERSION_CONFLICT",
    "Catalog category version is stale",
    { details: { targetType: "CATEGORY", expectedVersion } },
  );
}
 
function throwServiceVersionConflict(expectedVersion: number): never {
  throw new CatalogError(
    "CATALOG_VERSION_CONFLICT",
    "Catalog service version is stale",
    { details: { targetType: "SERVICE", expectedVersion } },
  );
}
 
export class PrismaCatalogRepository implements CatalogRepository {
  readonly unitOfWork: CatalogUnitOfWork;
 
  constructor(
    private readonly client: PrismaClient = getPrismaClient(),
    private readonly createActiveCountryReader: CreateActiveCountryReaderFactory,
    private readonly createPrivilegedAuditWriter: CreatePrivilegedAuditWriterFactory,
    private readonly createCatalogServiceImageAuthorizer: CreateCatalogServiceImageAuthorizerFactory,
    private readonly createCatalogServiceMediaFactsReader: CreateCatalogServiceMediaFactsReaderFactory,
  ) {
    this.unitOfWork = {
      runInTransaction: async (work) =>
        this.client.$transaction(
          async (tx) =>
            work({
              tx,
              activeCountryReader: this.createActiveCountryReader(tx),
              privilegedAuditWriter: this.createPrivilegedAuditWriter(tx),
              catalogServiceImageAuthorizer:
                this.createCatalogServiceImageAuthorizer(tx),
            }),
          CATALOG_UNIT_OF_WORK_TRANSACTION_OPTIONS,
        ),
      runInReadSnapshot: async (work) =>
        this.client.$transaction(
          async (tx) =>
            work({
              tx,
              activeCountryReader: this.createActiveCountryReader(tx),
              privilegedAuditWriter: this.createPrivilegedAuditWriter(tx),
              catalogServiceImageAuthorizer:
                this.createCatalogServiceImageAuthorizer(tx),
            }),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            ...CATALOG_UNIT_OF_WORK_TRANSACTION_OPTIONS,
          },
        ),
      bindToTransaction: (transactionContext) => {
        const tx = transactionContext as CatalogTransactionClient;
        return {
          tx,
          activeCountryReader: this.createActiveCountryReader(tx),
          privilegedAuditWriter: this.createPrivilegedAuditWriter(tx),
          catalogServiceImageAuthorizer:
            this.createCatalogServiceImageAuthorizer(tx),
        };
      },
    };
  }
 
  async reserveOrReplayCommand(
    tx: CatalogTransactionClient,
    input: CatalogReserveOrReplayInput,
  ): Promise<CatalogCommandReceipt | "proceed"> {
    await acquireCatalogIdempotencyLock(
      tx,
      input.actorUserId,
      input.scopeKey,
      input.idempotencyKey,
    );

    const existing = await tx.catalogCommandRequest.findUnique({
      where: catalogCommandLookupWhere(input),
    });

    if (existing !== null) {
      if (existing.actorUserId !== input.actorUserId) {
        throw new CatalogError(
          "CATALOG_IDEMPOTENCY_CONFLICT",
          "Catalog command idempotency key belongs to another actor",
        );
      }
      if (existing.requestHash !== input.requestHash) {
        throw new CatalogError(
          "CATALOG_IDEMPOTENCY_CONFLICT",
          "Catalog command idempotency key reused with a different payload",
        );
      }
      return {
        id: existing.id,
        status: existing.status,
        targetType: existing.targetType,
        targetId: existing.targetId,
        acceptedVersion: existing.acceptedVersion,
        replayed: true,
        reservedMediaFileId: existing.reservedMediaFileId,
      };
    }

    if (input.pending === true) {
      if (input.reservedMediaFileId.length === 0) {
        throw new CatalogError(
          "CATALOG_VALIDATION_FAILED",
          "Pending Catalog media commands require a reserved media identity",
        );
      }
      const created = await tx.catalogCommandRequest.create({
        data: {
          actorUserId: input.actorUserId,
          scopeKey: input.scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          status: "PENDING",
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          reservedMediaFileId: input.reservedMediaFileId,
        },
      });
      return {
        id: created.id,
        status: "PENDING",
        targetType: created.targetType,
        targetId: created.targetId,
        acceptedVersion: null,
        replayed: false,
        reservedMediaFileId: created.reservedMediaFileId,
      };
    }

    return "proceed";
  }
 
  async completeCommand(
    tx: CatalogTransactionClient,
    input: {
      readonly scopeKey: string;
      readonly idempotencyKey: string;
      readonly targetId: string;
      readonly acceptedVersion: number;
      readonly actorUserId: string;
      readonly requestHash: string;
      readonly targetType: string;
    },
  ): Promise<CatalogCommandReceipt> {
    const existing = await tx.catalogCommandRequest.findUnique({
      where: catalogCommandLookupWhere(input),
    });

    if (existing !== null) {
      if (existing.actorUserId !== input.actorUserId) {
        throw new CatalogError(
          "CATALOG_IDEMPOTENCY_CONFLICT",
          "Catalog command idempotency key belongs to another actor",
        );
      }
      if (existing.requestHash !== input.requestHash) {
        throw new CatalogError(
          "CATALOG_IDEMPOTENCY_CONFLICT",
          "Catalog command idempotency key reused with a different payload",
        );
      }
      if (existing.status === "COMPLETED") {
        return {
          id: existing.id,
          status: "COMPLETED",
          targetType: existing.targetType,
          targetId: existing.targetId,
          acceptedVersion: existing.acceptedVersion,
          replayed: true,
        };
      }
      const updated = await tx.catalogCommandRequest.update({
        where: { id: existing.id },
        data: {
          status: "COMPLETED",
          targetId: input.targetId,
          acceptedVersion: input.acceptedVersion,
          completedAt: new Date(),
        },
      });
      return {
        id: updated.id,
        status: "COMPLETED",
        targetType: updated.targetType,
        targetId: updated.targetId,
        acceptedVersion: updated.acceptedVersion,
        replayed: false,
      };
    }
 
    const created = await tx.catalogCommandRequest.create({
      data: {
        actorUserId: input.actorUserId,
        scopeKey: input.scopeKey,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        status: "COMPLETED",
        targetType: input.targetType,
        targetId: input.targetId,
        acceptedVersion: input.acceptedVersion,
        completedAt: new Date(),
      },
    });
    return {
      id: created.id,
      status: "COMPLETED",
      targetType: created.targetType,
      targetId: created.targetId,
      acceptedVersion: created.acceptedVersion,
      replayed: false,
    };
  }
 
  async lockCategory(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<CatalogCategoryRow | null> {
    return this.findCategory(tx, categoryId);
  }
 
  async findCategory(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<CatalogCategoryRow | null> {
    const row = await tx.serviceCategory.findUnique({ where: { id: categoryId } });
    return row === null ? null : mapCategory(row);
  }
 
  async findCategoryByCode(
    tx: CatalogTransactionClient,
    code: string,
  ): Promise<CatalogCategoryRow | null> {
    const row = await tx.serviceCategory.findUnique({ where: { code } });
    return row === null ? null : mapCategory(row);
  }
 
  async listCategories(
    tx: CatalogTransactionClient,
    query: CatalogCursorQueryInput,
  ): Promise<CatalogPage<CatalogCategoryRow>> {
    const limit = resolvePageLimit(query.limit);
    const rows = await tx.serviceCategory.findMany({
      ...buildCursorArgs(query.cursor),
      take: limit + 1,
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(mapCategory),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
 
  async nextCategoryDisplayOrder(tx: CatalogTransactionClient): Promise<number> {
    const aggregate = await tx.serviceCategory.aggregate({
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }
 
  async insertCategory(
    tx: CatalogTransactionClient,
    input: CatalogCategoryContentInput & {
      readonly code: string;
      readonly displayOrder: number;
    },
  ): Promise<CatalogCategoryRow> {
    try {
      const row = await tx.serviceCategory.create({
        data: {
          code: input.code,
          displayOrder: input.displayOrder,
          nameAr: input.nameAr,
          nameEn: input.nameEn,
          descriptionAr: input.descriptionAr,
          descriptionEn: input.descriptionEn,
          isActive: false,
          version: 1,
        },
      });
      return mapCategory(row);
    } catch (error) {
      mapUniqueConflict(error, "code");
    }
  }
 
  async updateCategory(
    tx: CatalogTransactionClient,
    input: {
      readonly categoryId: string;
      readonly expectedVersion: number;
      readonly content?: CatalogCategoryContentInput;
      readonly isActive?: boolean;
    },
  ): Promise<CatalogCategoryRow> {
    const data: Prisma.ServiceCategoryUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    if (input.content !== undefined) {
      data.nameAr = input.content.nameAr;
      data.nameEn = input.content.nameEn;
      data.descriptionAr = input.content.descriptionAr;
      data.descriptionEn = input.content.descriptionEn;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
 
    const updated = await tx.serviceCategory.updateMany({
      where: { id: input.categoryId, version: input.expectedVersion },
      data,
    });
    if (updated.count !== 1) {
      throwCategoryVersionConflict(input.expectedVersion);
    }
 
    const row = await this.findCategory(tx, input.categoryId);
    if (row === null) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
    }
    return row;
  }
 
  async lockChildServiceIds(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<readonly string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM services
      WHERE category_id = ${categoryId}
      ORDER BY id
      FOR UPDATE
    `;
    return rows.map((row) => row.id);
  }
 
  async bumpServiceVersions(
    tx: CatalogTransactionClient,
    serviceIds: readonly string[],
  ): Promise<number> {
    if (serviceIds.length === 0) {
      return 0;
    }
    const result = await tx.service.updateMany({
      where: { id: { in: [...serviceIds] } },
      data: { version: { increment: 1 } },
    });
    return result.count;
  }
 
  async lockService(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<CatalogServiceRow | null> {
    return this.findService(tx, serviceId);
  }
 
  async findService(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<CatalogServiceRow | null> {
    const row = await tx.service.findUnique({
      where: { id: serviceId },
      include: { translations: true },
    });
    return row === null ? null : mapService(row);
  }
 
  async findServiceByCode(
    tx: CatalogTransactionClient,
    code: string,
  ): Promise<CatalogServiceRow | null> {
    const row = await tx.service.findUnique({
      where: { code },
      include: { translations: true },
    });
    return row === null ? null : mapService(row);
  }
 
  async listServices(
    tx: CatalogTransactionClient,
    query: CatalogCursorQueryInput & { readonly categoryId?: string | undefined },
  ): Promise<CatalogPage<CatalogServiceRow>> {
    const limit = resolvePageLimit(query.limit);
    const rows = await tx.service.findMany({
      ...(query.categoryId === undefined
        ? {}
        : { where: { categoryId: query.categoryId } }),
      ...buildCursorArgs(query.cursor),
      take: limit + 1,
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: { translations: true },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(mapService),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
 
  async nextServiceDisplayOrder(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<number> {
    const aggregate = await tx.service.aggregate({
      where: { categoryId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }
 
  async insertService(
    tx: CatalogTransactionClient,
    input: {
      readonly categoryId: string;
      readonly code: string;
      readonly displayOrder: number;
      readonly translations: readonly CatalogServiceTranslationRow[];
    },
  ): Promise<CatalogServiceRow> {
    try {
      const row = await tx.service.create({
        data: {
          categoryId: input.categoryId,
          code: input.code,
          displayOrder: input.displayOrder,
          isActive: false,
          version: 1,
          translations: {
            create: input.translations.map((translation) => ({
              locale: translation.locale,
              name: translation.name,
              description: translation.description,
            })),
          },
        },
        include: { translations: true },
      });
      return mapService(row);
    } catch (error) {
      mapUniqueConflict(error, "code");
    }
  }
 
  async updateService(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly expectedVersion: number;
      readonly categoryId?: string;
      readonly displayOrder?: number;
      readonly isActive?: boolean;
    },
  ): Promise<CatalogServiceRow> {
    const data: Prisma.ServiceUncheckedUpdateManyInput = {
      version: { increment: 1 },
    };
    if (input.categoryId !== undefined) {
      data.categoryId = input.categoryId;
    }
    if (input.displayOrder !== undefined) {
      data.displayOrder = input.displayOrder;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
 
    try {
      const updated = await tx.service.updateMany({
        where: { id: input.serviceId, version: input.expectedVersion },
        data,
      });
      if (updated.count !== 1) {
        throwServiceVersionConflict(input.expectedVersion);
      }
    } catch (error) {
      if (error instanceof CatalogError) {
        throw error;
      }
      mapUniqueConflict(error, input.categoryId !== undefined ? "displayOrder" : "code");
    }
 
    const row = await this.findService(tx, input.serviceId);
    if (row === null) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    return row;
  }
 
  async upsertServiceTranslations(
    tx: CatalogTransactionClient,
    serviceId: string,
    translations: readonly CatalogServiceTranslationRow[],
  ): Promise<void> {
    for (const translation of translations) {
      await tx.serviceTranslation.upsert({
        where: {
          serviceId_locale: {
            serviceId,
            locale: translation.locale,
          },
        },
        create: {
          serviceId,
          locale: translation.locale,
          name: translation.name,
          description: translation.description,
        },
        update: {
          name: translation.name,
          description: translation.description,
        },
      });
    }
  }
 
  async findServiceWithConfiguration(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<CatalogServiceWithConfigurationRow | null> {
    const row = await tx.service.findUnique({
      where: { id: serviceId },
      include: {
        translations: true,
        priceUnits: true,
        fields: { include: { options: true } },
      },
    });
    return row === null ? null : mapServiceWithConfiguration(row);
  }
 
  async replaceServiceConfiguration(
    tx: CatalogTransactionClient,
    input: CatalogServiceConfigurationReplacementInput,
  ): Promise<CatalogServiceWithConfigurationRow> {
    const locked = await tx.$queryRaw<Array<{ id: string; version: number }>>`
      SELECT id, version
      FROM services
      WHERE id = ${input.serviceId}
      FOR UPDATE
    `;
    if (locked.length !== 1) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    const lockedRow = locked[0];
    if (lockedRow === undefined || lockedRow.version !== input.expectedVersion) {
      throwServiceVersionConflict(input.expectedVersion);
    }
 
    const existing = await tx.service.findUnique({
      where: { id: input.serviceId },
      include: {
        translations: true,
        priceUnits: true,
        fields: { include: { options: true } },
      },
    });
    if (existing === null) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
 
    const existingUnitsByCode = new Map(
      existing.priceUnits.map((unit) => [unit.code, unit]),
    );
    const existingFieldsByCode = new Map(
      existing.fields.map((field) => [field.code, field]),
    );
    const presentUnitCodes = new Set(input.priceUnits.map((unit) => unit.code));
    const presentFieldCodes = new Set(input.fields.map((field) => field.code));
    const omittedUnits = existing.priceUnits
      .filter((unit) => !presentUnitCodes.has(unit.code))
      .slice()
      .sort(compareByDisplayOrderThenId);
    const omittedFields = existing.fields
      .filter((field) => !presentFieldCodes.has(field.code))
      .slice()
      .sort(compareByDisplayOrderThenId);
    const newUnitCount = input.priceUnits.filter(
      (unit) => !existingUnitsByCode.has(unit.code),
    ).length;
    const newFieldCount = input.fields.filter(
      (field) => !existingFieldsByCode.has(field.code),
    ).length;
 
    try {
      await this.upsertServiceTranslations(tx, input.serviceId, input.translations);
 
      const unitFinalCount = existing.priceUnits.length + newUnitCount;
      if (existing.priceUnits.length > 0) {
        const unitTempBase = temporaryDisplayOrderBase(
          existing.priceUnits.map((unit) => unit.displayOrder),
          unitFinalCount,
        );
        for (let index = 0; index < existing.priceUnits.length; index += 1) {
          const unit = existing.priceUnits[index];
          if (unit === undefined) {
            continue;
          }
          await tx.servicePriceUnit.update({
            where: { id: unit.id },
            data: { displayOrder: unitTempBase + index },
          });
        }
      }
 
      for (let index = 0; index < input.priceUnits.length; index += 1) {
        const unit = input.priceUnits[index];
        if (unit === undefined) {
          continue;
        }
        const current = existingUnitsByCode.get(unit.code);
        if (current !== undefined) {
          await tx.servicePriceUnit.update({
            where: { id: current.id },
            data: {
              labelAr: unit.labelAr,
              labelEn: unit.labelEn,
              displayOrder: index,
              isActive: unit.isActive,
            },
          });
        } else {
          await tx.servicePriceUnit.create({
            data: {
              serviceId: input.serviceId,
              code: unit.code,
              labelAr: unit.labelAr,
              labelEn: unit.labelEn,
              displayOrder: index,
              isActive: unit.isActive,
            },
          });
        }
      }
 
      for (let index = 0; index < omittedUnits.length; index += 1) {
        const unit = omittedUnits[index];
        if (unit === undefined) {
          continue;
        }
        await tx.servicePriceUnit.update({
          where: { id: unit.id },
          data: {
            isActive: false,
            displayOrder: input.priceUnits.length + index,
          },
        });
      }
 
      const fieldFinalCount = existing.fields.length + newFieldCount;
      if (existing.fields.length > 0) {
        const fieldTempBase = temporaryDisplayOrderBase(
          existing.fields.map((field) => field.displayOrder),
          fieldFinalCount,
        );
        for (let index = 0; index < existing.fields.length; index += 1) {
          const field = existing.fields[index];
          if (field === undefined) {
            continue;
          }
          await tx.serviceField.update({
            where: { id: field.id },
            data: { displayOrder: fieldTempBase + index },
          });
        }
      }
 
      for (let fieldIndex = 0; fieldIndex < input.fields.length; fieldIndex += 1) {
        const field = input.fields[fieldIndex];
        if (field === undefined) {
          continue;
        }
        const currentField = existingFieldsByCode.get(field.code);
        const fieldData = {
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
          minValue:
            field.minValue === null ? null : new Prisma.Decimal(field.minValue),
          maxValue:
            field.maxValue === null ? null : new Prisma.Decimal(field.maxValue),
          minSelections: field.minSelections,
          maxSelections: field.maxSelections,
          displayOrder: fieldIndex,
        };
 
        let fieldId: string;
        let existingOptions = currentField?.options ?? [];
        if (currentField !== undefined) {
          await tx.serviceField.update({
            where: { id: currentField.id },
            data: fieldData,
          });
          fieldId = currentField.id;
        } else {
          const created = await tx.serviceField.create({
            data: {
              serviceId: input.serviceId,
              code: field.code,
              ...fieldData,
            },
          });
          fieldId = created.id;
          existingOptions = [];
        }
 
        const existingOptionsByValue = new Map(
          existingOptions.map((option) => [option.value, option]),
        );
        const presentOptionValues = new Set(
          field.options.map((option) => option.value),
        );
        const omittedOptions = existingOptions
          .filter((option) => !presentOptionValues.has(option.value))
          .slice()
          .sort(compareByDisplayOrderThenId);
        const newOptionCount = field.options.filter(
          (option) => !existingOptionsByValue.has(option.value),
        ).length;
        const optionFinalCount = existingOptions.length + newOptionCount;
 
        if (existingOptions.length > 0) {
          const optionTempBase = temporaryDisplayOrderBase(
            existingOptions.map((option) => option.displayOrder),
            optionFinalCount,
          );
          for (let index = 0; index < existingOptions.length; index += 1) {
            const option = existingOptions[index];
            if (option === undefined) {
              continue;
            }
            await tx.serviceFieldOption.update({
              where: { id: option.id },
              data: { displayOrder: optionTempBase + index },
            });
          }
        }
 
        for (let optionIndex = 0; optionIndex < field.options.length; optionIndex += 1) {
          const option = field.options[optionIndex];
          if (option === undefined) {
            continue;
          }
          const currentOption = existingOptionsByValue.get(option.value);
          if (currentOption !== undefined) {
            await tx.serviceFieldOption.update({
              where: { id: currentOption.id },
              data: {
                labelAr: option.labelAr,
                labelEn: option.labelEn,
                displayOrder: optionIndex,
                isActive: option.isActive,
              },
            });
          } else {
            await tx.serviceFieldOption.create({
              data: {
                serviceFieldId: fieldId,
                value: option.value,
                labelAr: option.labelAr,
                labelEn: option.labelEn,
                displayOrder: optionIndex,
                isActive: option.isActive,
              },
            });
          }
        }
 
        for (let index = 0; index < omittedOptions.length; index += 1) {
          const option = omittedOptions[index];
          if (option === undefined) {
            continue;
          }
          await tx.serviceFieldOption.update({
            where: { id: option.id },
            data: {
              isActive: false,
              displayOrder: field.options.length + index,
            },
          });
        }
      }
 
      for (let index = 0; index < omittedFields.length; index += 1) {
        const field = omittedFields[index];
        if (field === undefined) {
          continue;
        }
        await tx.serviceField.update({
          where: { id: field.id },
          data: {
            isActive: false,
            displayOrder: input.fields.length + index,
          },
        });
        for (const option of field.options) {
          await tx.serviceFieldOption.update({
            where: { id: option.id },
            data: { isActive: false },
          });
        }
      }
 
      const updated = await tx.service.updateMany({
        where: { id: input.serviceId, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throwServiceVersionConflict(input.expectedVersion);
      }
    } catch (error) {
      if (error instanceof CatalogError) {
        throw error;
      }
      mapUniqueConflict(error, "displayOrder");
    }
 
    const row = await this.findServiceWithConfiguration(tx, input.serviceId);
    if (row === null) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    return row;
  }
 
  async lockAllCategories(
    tx: CatalogTransactionClient,
  ): Promise<readonly CatalogCategoryRow[]> {
    const rows = await tx.$queryRaw<
      Array<{
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
      }>
    >`
      SELECT
        id,
        code,
        name_ar AS "nameAr",
        name_en AS "nameEn",
        description_ar AS "descriptionAr",
        description_en AS "descriptionEn",
        display_order AS "displayOrder",
        is_active AS "isActive",
        version,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM service_categories
      ORDER BY id
      FOR UPDATE
    `;
    return rows.map(mapCategory);
  }
 
  async replaceCategoryOrder(
    tx: CatalogTransactionClient,
    input: {
      readonly orderedIds: readonly string[];
      readonly positions: readonly number[];
    },
  ): Promise<readonly CatalogCategoryRow[]> {
    const locked = await this.lockAllCategories(tx);
    if (locked.length === 0) {
      return locked;
    }
 
    const tempBase = temporaryDisplayOrderBase(
      locked.map((row) => row.displayOrder),
      input.orderedIds.length,
    );
 
    try {
      for (let index = 0; index < locked.length; index += 1) {
        const row = locked[index];
        if (row === undefined) {
          continue;
        }
        await tx.serviceCategory.update({
          where: { id: row.id },
          data: { displayOrder: tempBase + index },
        });
      }
 
      for (let index = 0; index < input.orderedIds.length; index += 1) {
        const categoryId = input.orderedIds[index];
        const position = input.positions[index];
        if (categoryId === undefined || position === undefined) {
          continue;
        }
        const updated = await tx.serviceCategory.updateMany({
          where: { id: categoryId },
          data: {
            displayOrder: position,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new CatalogError("CATALOG_NOT_FOUND", "Catalog category was not found");
        }
      }
    } catch (error) {
      if (error instanceof CatalogError) {
        throw error;
      }
      mapUniqueConflict(error, "displayOrder");
    }
 
    const childIds: string[] = [];
    for (const categoryId of input.orderedIds) {
      const ids = await this.lockChildServiceIds(tx, categoryId);
      childIds.push(...ids);
    }
    await this.bumpServiceVersions(tx, childIds);
 
    return this.lockAllCategories(tx);
  }
 
  async lockServicesInCategory(
    tx: CatalogTransactionClient,
    categoryId: string,
  ): Promise<readonly CatalogServiceRow[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM services
      WHERE category_id = ${categoryId}
      ORDER BY id
      FOR UPDATE
    `;
    const services: CatalogServiceRow[] = [];
    for (const row of rows) {
      const service = await this.findService(tx, row.id);
      if (service !== null) {
        services.push(service);
      }
    }
    return services;
  }
 
  async replaceServiceOrder(
    tx: CatalogTransactionClient,
    input: {
      readonly categoryId: string;
      readonly orderedIds: readonly string[];
      readonly positions: readonly number[];
    },
  ): Promise<readonly CatalogServiceRow[]> {
    const locked = await this.lockServicesInCategory(tx, input.categoryId);
    if (locked.length === 0) {
      return locked;
    }
 
    const tempBase = temporaryDisplayOrderBase(
      locked.map((row) => row.displayOrder),
      input.orderedIds.length,
    );
 
    try {
      for (let index = 0; index < locked.length; index += 1) {
        const row = locked[index];
        if (row === undefined) {
          continue;
        }
        await tx.service.update({
          where: { id: row.id },
          data: { displayOrder: tempBase + index },
        });
      }
 
      for (let index = 0; index < input.orderedIds.length; index += 1) {
        const serviceId = input.orderedIds[index];
        const position = input.positions[index];
        if (serviceId === undefined || position === undefined) {
          continue;
        }
        const updated = await tx.service.updateMany({
          where: { id: serviceId, categoryId: input.categoryId },
          data: {
            displayOrder: position,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
        }
      }
    } catch (error) {
      if (error instanceof CatalogError) {
        throw error;
      }
      mapUniqueConflict(error, "displayOrder");
    }
 
    return this.lockServicesInCategory(tx, input.categoryId);
  }
 
  async listServiceCountryAvailability(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<readonly CatalogServiceCountryAvailabilityRow[]> {
    const rows = await tx.serviceCountryAvailability.findMany({
      where: { serviceId },
      include: { country: true },
      orderBy: [{ country: { code: "asc" } }],
    });
    return rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      countryCode: row.country.code,
      isAvailable: row.isAvailable,
    }));
  }
 
  async replaceServiceCountryAvailability(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly expectedVersion: number;
      readonly countries: readonly {
        readonly countryId: string;
        readonly countryCode: string;
        readonly isAvailable: boolean;
      }[];
    },
  ): Promise<CatalogServiceWithConfigurationRow> {
    const locked = await tx.$queryRaw<Array<{ id: string; version: number }>>`
      SELECT id, version
      FROM services
      WHERE id = ${input.serviceId}
      FOR UPDATE
    `;
    if (locked.length !== 1) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    const lockedRow = locked[0];
    if (lockedRow === undefined || lockedRow.version !== input.expectedVersion) {
      throwServiceVersionConflict(input.expectedVersion);
    }
 
    const existing = await tx.serviceCountryAvailability.findMany({
      where: { serviceId: input.serviceId },
    });
    const existingByCountryId = new Map(
      existing.map((row) => [row.countryId, row]),
    );
    const presentCountryIds = new Set(
      input.countries.map((country) => country.countryId),
    );
 
    for (const country of input.countries) {
      const current = existingByCountryId.get(country.countryId);
      if (current !== undefined) {
        await tx.serviceCountryAvailability.update({
          where: { id: current.id },
          data: { isAvailable: country.isAvailable },
        });
      } else {
        await tx.serviceCountryAvailability.create({
          data: {
            serviceId: input.serviceId,
            countryId: country.countryId,
            isAvailable: country.isAvailable,
          },
        });
      }
    }
 
    for (const row of existing) {
      if (!presentCountryIds.has(row.countryId)) {
        await tx.serviceCountryAvailability.update({
          where: { id: row.id },
          data: { isAvailable: false },
        });
      }
    }
 
    const updated = await tx.service.updateMany({
      where: { id: input.serviceId, version: input.expectedVersion },
      data: { version: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throwServiceVersionConflict(input.expectedVersion);
    }
 
    const row = await this.findServiceWithConfiguration(tx, input.serviceId);
    if (row === null) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Catalog service was not found");
    }
    return row;
  }
 
  async listSelectableServiceCandidates(
    tx: CatalogTransactionClient,
    input: {
      readonly countryId: string;
      readonly cursor?: string | undefined;
      readonly limit?: number | undefined;
    },
  ): Promise<CatalogPage<SelectableServiceCandidateRow>> {
    const limit = resolvePageLimit(input.limit);
    const rows = await tx.service.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
        countryRows: {
          some: {
            countryId: input.countryId,
            isAvailable: true,
          },
        },
      },
      ...buildCursorArgs(input.cursor),
      take: limit + 1,
      orderBy: [
        { category: { displayOrder: "asc" } },
        { displayOrder: "asc" },
        { id: "asc" },
      ],
      include: {
        translations: true,
        priceUnits: true,
        fields: { include: { options: true } },
        category: true,
        countryRows: {
          where: { countryId: input.countryId },
        },
      },
    });
 
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => {
        const availability = row.countryRows[0];
        return {
          category: mapCategory(row.category),
          service: mapServiceWithConfiguration(row),
          countryAvailabilityIsAvailable: availability?.isAvailable ?? false,
        };
      }),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
 
  async findSelectableServiceByCode(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceCode: string;
      readonly countryId: string;
    },
  ): Promise<SelectableServiceCandidateRow | null> {
    const row = await tx.service.findUnique({
      where: { code: input.serviceCode },
      include: {
        translations: true,
        priceUnits: true,
        fields: { include: { options: true } },
        category: true,
        countryRows: {
          where: { countryId: input.countryId },
        },
      },
    });
    if (row === null) {
      return null;
    }
    const availability = row.countryRows[0];
    return {
      category: mapCategory(row.category),
      service: mapServiceWithConfiguration(row),
      countryAvailabilityIsAvailable: availability?.isAvailable ?? false,
    };
  }

  async findSelectableServiceById(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly countryId: string;
    },
  ): Promise<SelectableServiceCandidateRow | null> {
    const row = await tx.service.findUnique({
      where: { id: input.serviceId },
      include: {
        translations: true,
        priceUnits: true,
        fields: { include: { options: true } },
        category: true,
        countryRows: {
          where: { countryId: input.countryId },
        },
      },
    });
    if (row === null) {
      return null;
    }
    const availability = row.countryRows[0];
    return {
      category: mapCategory(row.category),
      service: mapServiceWithConfiguration(row),
      countryAvailabilityIsAvailable: availability?.isAvailable ?? false,
    };
  }

  async listServiceMediaAssociations(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<readonly CatalogServiceMediaAssociationRow[]> {
    const rows = await tx.serviceMediaAssociation.findMany({
      where: { serviceId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
    const facts = await this.createCatalogServiceMediaFactsReader(
      tx,
    ).readCatalogServiceMediaFacts(rows.map((row) => row.mediaFileId));
    return rows.map((row) => ({
      id: row.id,
      serviceId: row.serviceId,
      mediaFileId: row.mediaFileId,
      displayOrder: row.displayOrder,
      ...mapMediaFactToAssociationFields(facts.get(row.mediaFileId)),
    }));
  }
 
  async lockServiceMediaAssociations(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<readonly CatalogServiceMediaAssociationRow[]> {
    await tx.$queryRaw`
      SELECT id
      FROM service_media_associations
      WHERE service_id = ${serviceId}
      ORDER BY display_order ASC, id ASC
      FOR UPDATE
    `;
    return this.listServiceMediaAssociations(tx, serviceId);
  }
 
  async nextServiceMediaDisplayOrder(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<number> {
    const aggregate = await tx.serviceMediaAssociation.aggregate({
      where: { serviceId },
      _max: { displayOrder: true },
    });
    return (aggregate._max.displayOrder ?? -1) + 1;
  }
 
  async insertServiceMediaAssociation(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly mediaFileId: string;
      readonly displayOrder?: number;
    },
  ): Promise<CatalogServiceMediaAssociationRow> {
    const displayOrder =
      input.displayOrder ??
      (await this.nextServiceMediaDisplayOrder(tx, input.serviceId));
    try {
      const created = await tx.serviceMediaAssociation.create({
        data: {
          serviceId: input.serviceId,
          mediaFileId: input.mediaFileId,
          displayOrder,
        },
      });
      const facts = await this.createCatalogServiceMediaFactsReader(
        tx,
      ).readCatalogServiceMediaFacts([created.mediaFileId]);
      return {
        id: created.id,
        serviceId: created.serviceId,
        mediaFileId: created.mediaFileId,
        displayOrder: created.displayOrder,
        ...mapMediaFactToAssociationFields(facts.get(created.mediaFileId)),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new CatalogError(
          "CATALOG_MEDIA_INVALID",
          "Media file is already associated with a service",
        );
      }
      throw error;
    }
  }
 
  async replaceServiceMediaOrder(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly orderedAssociationIds: readonly string[];
    },
  ): Promise<readonly CatalogServiceMediaAssociationRow[]> {
    const locked = await this.lockServiceMediaAssociations(tx, input.serviceId);
    const currentIds = locked.map((row) => row.id);
    if (
      input.orderedAssociationIds.length !== currentIds.length ||
      new Set(input.orderedAssociationIds).size !==
        input.orderedAssociationIds.length ||
      input.orderedAssociationIds.some((id) => !currentIds.includes(id))
    ) {
      throw new CatalogError(
        "CATALOG_ORDER_INVALID",
        "Media order must be an exact association set",
      );
    }
 
    const tempBase = temporaryDisplayOrderBase(
      locked.map((row) => row.displayOrder),
      input.orderedAssociationIds.length,
    );
 
    try {
      for (let index = 0; index < locked.length; index += 1) {
        const row = locked[index];
        if (row === undefined) {
          continue;
        }
        await tx.serviceMediaAssociation.update({
          where: { id: row.id },
          data: { displayOrder: tempBase + index },
        });
      }
 
      for (let index = 0; index < input.orderedAssociationIds.length; index += 1) {
        const associationId = input.orderedAssociationIds[index];
        if (associationId === undefined) {
          continue;
        }
        await tx.serviceMediaAssociation.update({
          where: { id: associationId },
          data: { displayOrder: index },
        });
      }
    } catch (error) {
      if (error instanceof CatalogError) {
        throw error;
      }
      mapUniqueConflict(error, "displayOrder");
    }
 
    return this.listServiceMediaAssociations(tx, input.serviceId);
  }
 
  async removeServiceMediaAssociation(
    tx: CatalogTransactionClient,
    input: {
      readonly serviceId: string;
      readonly associationId: string;
    },
  ): Promise<void> {
    const locked = await this.lockServiceMediaAssociations(tx, input.serviceId);
    const target = locked.find((row) => row.id === input.associationId);
    if (target === undefined) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Media association not found", {
        httpStatus: 404,
      });
    }
 
    await tx.serviceMediaAssociation.delete({
      where: { id: input.associationId },
    });
 
    const remaining = locked
      .filter((row) => row.id !== input.associationId)
      .sort((left, right) => left.displayOrder - right.displayOrder);
 
    const tempBase = temporaryDisplayOrderBase(
      remaining.map((row) => row.displayOrder),
      remaining.length,
    );
    for (let index = 0; index < remaining.length; index += 1) {
      const row = remaining[index];
      if (row === undefined) {
        continue;
      }
      await tx.serviceMediaAssociation.update({
        where: { id: row.id },
        data: { displayOrder: tempBase + index },
      });
    }
    for (let index = 0; index < remaining.length; index += 1) {
      const row = remaining[index];
      if (row === undefined) {
        continue;
      }
      await tx.serviceMediaAssociation.update({
        where: { id: row.id },
        data: { displayOrder: index },
      });
    }
  }
 
  async bumpServiceVersion(
    tx: CatalogTransactionClient,
    serviceId: string,
  ): Promise<number> {
    const updated = await tx.service.update({
      where: { id: serviceId },
      data: { version: { increment: 1 } },
      select: { version: true },
    });
    return updated.version;
  }
}
