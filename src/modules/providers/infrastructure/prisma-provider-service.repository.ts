/**
 * Persistence-only Prisma repository for R1-P09 Provider Service tables.
 * No Catalog/Configuration/business orchestration; money uses Decimal(65,0)
 * mapped to/from exact minor-unit digit strings.
 */

import { Prisma, type PrismaClient } from "#generated/prisma/client";
import { createTransactionalProviderServiceCountryIdentityReader, type ProviderServiceCountryIdentityReader } from "#modules/configuration/configuration.public";

import type {
  CreateProviderServiceOfferingInput,
  CreateProviderServicePriceInput,
  ProviderServiceCursorPage,
  ProviderServiceRepository,
  SetProviderServiceEnabledInput,
  StaffPendingPricePersistenceRow,
  TransitionProviderServicePriceInput,
  UpdateProviderServiceConfigurationInput,
} from "../domain/provider-service.ports.js";
import { ProviderServiceError } from "../domain/provider-service.errors.js";
import {
  PROVIDER_SERVICE_MANAGEMENT_STATUS_EVENTS,
  type MinorUnitsDigitString,
  type ProviderServiceOfferingSafeFacts,
  type ProviderServicePriceHistoryInput,
  type ProviderServicePriceHistorySnapshot,
  type ProviderServicePriceSafeFacts,
  type ProviderServicePriceSnapshot,
  type ProviderServiceReadinessProjection,
  type ProviderServiceReceiptLookup,
  type ProviderServiceSafeResultJson,
  type ProviderServiceSnapshot,
  type ProviderServiceStatusHistoryInput,
  type ProviderServiceStatusHistorySnapshot,
} from "../domain/provider-service.types.js";
import {
  mapPrismaProviderServiceError,
  providerServiceStaleVersionError,
} from "./provider-service-prisma-errors.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

const OFFERING_SELECT = {
  id: true,
  providerId: true,
  catalogServiceId: true,
  enabled: true,
  estimatedDurationMinutes: true,
  noteAr: true,
  noteEn: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PRICE_SELECT = {
  id: true,
  providerId: true,
  providerServiceId: true,
  catalogServiceId: true,
  catalogPriceUnitId: true,
  priceUnitCodeAtProposal: true,
  countryIdAtProposal: true,
  countryCodeAtProposal: true,
  currencyId: true,
  currencyCode: true,
  currencyDecimalPlaces: true,
  providerPriceMinorUnits: true,
  minimumChargeMinorUnits: true,
  maximumPriceMinorUnitsAtProposal: true,
  approvalRequiredAtProposal: true,
  status: true,
  proposedByUserId: true,
  effectiveAt: true,
  rejectedAt: true,
  supersededAt: true,
  createdAt: true,
} as const;

const PRICE_HISTORY_SELECT = {
  id: true,
  providerId: true,
  providerServiceId: true,
  providerServicePriceId: true,
  event: true,
  fromStatus: true,
  toStatus: true,
  actorUserId: true,
  reasonCode: true,
  reasonText: true,
  safeBefore: true,
  safeAfter: true,
  requestId: true,
  aggregateVersion: true,
  scopeKey: true,
  idempotencyKey: true,
  requestFingerprint: true,
  safeResultCode: true,
  safeResultJson: true,
  operationKey: true,
  createdAt: true,
} as const;

const STATUS_HISTORY_SELECT = {
  id: true,
  providerId: true,
  providerServiceId: true,
  event: true,
  fromEnabled: true,
  toEnabled: true,
  actorUserId: true,
  reasonCode: true,
  reasonText: true,
  safeBefore: true,
  safeAfter: true,
  requestId: true,
  aggregateVersion: true,
  scopeKey: true,
  idempotencyKey: true,
  requestFingerprint: true,
  safeResultCode: true,
  safeResultJson: true,
  operationKey: true,
  createdAt: true,
} as const;

type OfferingRow = Prisma.ProviderServiceGetPayload<{
  select: typeof OFFERING_SELECT;
}>;
type PriceRow = Prisma.ProviderServicePriceGetPayload<{
  select: typeof PRICE_SELECT;
}>;
type PriceHistoryRow = Prisma.ProviderServicePriceHistoryGetPayload<{
  select: typeof PRICE_HISTORY_SELECT;
}>;
type StatusHistoryRow = Prisma.ProviderServiceStatusHistoryGetPayload<{
  select: typeof STATUS_HISTORY_SELECT;
}>;

/**
 * @desc Convert a Prisma Decimal(65,0) value to an exact minor-unit digit string.
 * @access Infrastructure
 */
function minorUnitsFromDecimal(value: Prisma.Decimal): MinorUnitsDigitString {
  if (!value.isInteger()) {
    throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
      details: { reason: "NON_INTEGER_MINOR_UNITS" },
    });
  }
  const text = value.toFixed(0);
  if (!/^[0-9]+$/u.test(text)) {
    throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
      details: { reason: "INVALID_MINOR_UNITS_TEXT" },
    });
  }
  return text;
}

/**
 * @desc Persist a minor-unit digit string as Prisma Decimal(65,0).
 * @access Infrastructure
 */
function decimalFromMinorUnits(value: MinorUnitsDigitString): Prisma.Decimal {
  if (typeof value !== "string" || !/^[0-9]+$/u.test(value)) {
    throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_INVALID", undefined, {
      details: { reason: "NON_DIGIT_MINOR_UNITS" },
    });
  }
  return new Prisma.Decimal(value);
}

function mapOffering(row: OfferingRow): ProviderServiceSnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    catalogServiceId: row.catalogServiceId,
    enabled: row.enabled,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    noteAr: row.noteAr,
    noteEn: row.noteEn,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPrice(row: PriceRow): ProviderServicePriceSnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    providerServiceId: row.providerServiceId,
    catalogServiceId: row.catalogServiceId,
    catalogPriceUnitId: row.catalogPriceUnitId,
    priceUnitCodeAtProposal: row.priceUnitCodeAtProposal,
    countryIdAtProposal: row.countryIdAtProposal,
    countryCodeAtProposal: row.countryCodeAtProposal,
    currencyId: row.currencyId,
    currencyCode: row.currencyCode,
    currencyDecimalPlaces: row.currencyDecimalPlaces,
    providerPriceMinorUnits: minorUnitsFromDecimal(row.providerPriceMinorUnits),
    minimumChargeMinorUnits: minorUnitsFromDecimal(row.minimumChargeMinorUnits),
    maximumPriceMinorUnitsAtProposal: minorUnitsFromDecimal(
      row.maximumPriceMinorUnitsAtProposal,
    ),
    approvalRequiredAtProposal: row.approvalRequiredAtProposal,
    status: row.status,
    proposedByUserId: row.proposedByUserId,
    effectiveAt: row.effectiveAt,
    rejectedAt: row.rejectedAt,
    supersededAt: row.supersededAt,
    createdAt: row.createdAt,
  };
}

function asSafeJsonObject(
  value: Prisma.JsonValue,
): ProviderServiceSafeResultJson {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED", undefined, {
      details: { reason: "INVALID_SAFE_JSON_OBJECT" },
    });
  }
  return value as ProviderServiceSafeResultJson;
}

function asPriceSafeFacts(
  value: Prisma.JsonValue | null,
): ProviderServicePriceSafeFacts | null {
  if (value === null) return null;
  return asSafeJsonObject(value) as ProviderServicePriceSafeFacts;
}

function asOfferingSafeFacts(
  value: Prisma.JsonValue | null,
): ProviderServiceOfferingSafeFacts | null {
  if (value === null) return null;
  return asSafeJsonObject(value) as ProviderServiceOfferingSafeFacts;
}

function mapPriceHistory(row: PriceHistoryRow): ProviderServicePriceHistorySnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    providerServiceId: row.providerServiceId,
    providerServicePriceId: row.providerServicePriceId,
    event: row.event,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorUserId: row.actorUserId,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    safeBefore: asPriceSafeFacts(row.safeBefore),
    safeAfter: asSafeJsonObject(row.safeAfter) as ProviderServicePriceSafeFacts,
    requestId: row.requestId,
    aggregateVersion: row.aggregateVersion,
    operationKey: row.operationKey,
    receipt: {
      scopeKey: row.scopeKey,
      idempotencyKey: row.idempotencyKey,
      requestFingerprint: row.requestFingerprint,
      safeResultCode: row.safeResultCode,
      safeResultJson:
        row.safeResultJson === null
          ? null
          : asSafeJsonObject(row.safeResultJson),
    },
    createdAt: row.createdAt,
  };
}

function mapStatusHistory(
  row: StatusHistoryRow,
): ProviderServiceStatusHistorySnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    providerServiceId: row.providerServiceId,
    event: row.event,
    fromEnabled: row.fromEnabled,
    toEnabled: row.toEnabled,
    actorUserId: row.actorUserId,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    safeBefore: asOfferingSafeFacts(row.safeBefore),
    safeAfter: asSafeJsonObject(row.safeAfter) as ProviderServiceOfferingSafeFacts,
    requestId: row.requestId,
    aggregateVersion: row.aggregateVersion,
    operationKey: row.operationKey,
    receipt: {
      scopeKey: row.scopeKey,
      idempotencyKey: row.idempotencyKey,
      requestFingerprint: row.requestFingerprint,
      safeResultCode: row.safeResultCode,
      safeResultJson: asSafeJsonObject(row.safeResultJson),
    },
    createdAt: row.createdAt,
  };
}

function applyChronologicalCursor<T extends object>(
  base: T,
  page: ProviderServiceCursorPage,
): T & {
  OR?: Array<
    | { createdAt: { gt: Date } }
    | { createdAt: Date; id: { gt: string } }
  >;
} {
  if (page.cursorCreatedAt === undefined || page.cursorId === undefined) {
    return base;
  }
  return {
    ...base,
    OR: [
      { createdAt: { gt: page.cursorCreatedAt } },
      {
        createdAt: page.cursorCreatedAt,
        id: { gt: page.cursorId },
      },
    ],
  };
}

function rethrowMapped(error: unknown): never {
  const mapped = mapPrismaProviderServiceError(error);
  if (mapped !== null) throw mapped;
  throw error;
}

/**
 * @desc Providers-owned persistence for offerings, prices, histories, receipts.
 * @access Infrastructure
 * @explanation Accepts a shared Prisma client or transaction client; services
 * never receive raw clients outside the unit of work.
 */
export class PrismaProviderServiceRepository implements ProviderServiceRepository {
  public constructor(
    private readonly db: DbClient,
    private readonly countryIdentityReader: ProviderServiceCountryIdentityReader = createTransactionalProviderServiceCountryIdentityReader(db),
  ) {}

  /**
   * @desc Lock the Provider row for mutation scoping and return lifecycle facts.
   * @access Infrastructure
   */
  public async lockProviderScope(providerId: string): Promise<{
    readonly id: string;
    readonly applicationStatus: string;
    readonly operationalStatus: string;
    readonly countryId: string | null;
    readonly countryCode: string | null;
  } | null> {
    const rows = await this.db.$queryRaw<
      Array<{
        id: string;
        application_status: string;
        operational_status: string;
        country_id: string | null;
      }>
    >`
      SELECT
        p."id" AS "id",
        p."application_status" AS "application_status",
        p."operational_status" AS "operational_status",
        pp."country_id" AS "country_id"
      FROM "providers" p
      LEFT JOIN "provider_profiles" pp ON pp."provider_id" = p."id"
      WHERE p."id" = ${providerId}
      FOR UPDATE OF p
    `;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      applicationStatus: row.application_status,
      operationalStatus: row.operational_status,
      countryId: row.country_id,
      countryCode: row.country_id === null ? null : await this.countryIdentityReader.getCountryCodeById(row.country_id),
    };
  }

  /**
   * @desc Load safe Provider display names for Staff projections.
   * @access Infrastructure
   */
  public async findProviderDisplayIdentity(providerId: string): Promise<{
    readonly displayNameAr: string | null;
    readonly displayNameEn: string | null;
  } | null> {
    const row = await this.db.provider.findUnique({
      where: { id: providerId },
      select: {
        profile: {
          select: {
            displayNameAr: true,
            displayNameEn: true,
          },
        },
      },
    });
    if (row === null) {
      return null;
    }
    return {
      displayNameAr: row.profile?.displayNameAr ?? null,
      displayNameEn: row.profile?.displayNameEn ?? null,
    };
  }

  /**
   * @desc Read exact Provider membership without locking.
   * @access Infrastructure
   */
  public async findActorMembership(
    providerId: string,
    actorUserId: string,
  ): Promise<{
    readonly level: "OWNER" | "ADMIN";
    readonly active: boolean;
  } | null> {
    const row = await this.db.providerMember.findUnique({
      where: {
        providerId_userId: { providerId, userId: actorUserId },
      },
      select: { level: true, status: true },
    });
    if (row === null) {
      return null;
    }
    if (row.level !== "OWNER" && row.level !== "ADMIN") {
      return null;
    }
    return { level: row.level, active: row.status === "ACTIVE" };
  }

  /**
   * @desc Lock exact Provider membership for mutation authorization rechecks.
   * @access Infrastructure
   */
  public async lockActorMembership(
    providerId: string,
    actorUserId: string,
  ): Promise<{
    readonly level: "OWNER" | "ADMIN";
    readonly active: boolean;
  } | null> {
    const rows = await this.db.$queryRaw<
      Array<{ level: "OWNER" | "ADMIN"; status: "ACTIVE" | "DISABLED" }>
    >`
      SELECT "level", "status"
      FROM "provider_members"
      WHERE "provider_id" = ${providerId}
        AND "user_id" = ${actorUserId}
      FOR UPDATE
    `;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    if (row.level !== "OWNER" && row.level !== "ADMIN") {
      return null;
    }
    return { level: row.level, active: row.status === "ACTIVE" };
  }

  /**
   * @desc Load one Provider Service offering snapshot.
   * @access Infrastructure
   */
  public async findOffering(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServiceSnapshot | null> {
    const row = await this.db.providerService.findFirst({
      where: { id: providerServiceId, providerId },
      select: OFFERING_SELECT,
    });
    return row === null ? null : mapOffering(row);
  }

  /**
   * @desc Lock one offering row for concurrent mutation.
   * @access Infrastructure
   */
  public async lockOffering(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServiceSnapshot | null> {
    const locked = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "provider_services"
      WHERE "id" = ${providerServiceId}
        AND "provider_id" = ${providerId}
      FOR UPDATE
    `;
    if (locked[0] === undefined) {
      return null;
    }
    return this.findOffering(providerId, providerServiceId);
  }

  /**
   * @desc Find an offering by Provider and Catalog service identity.
   * @access Infrastructure
   */
  public async findOfferingByCatalogService(
    providerId: string,
    catalogServiceId: string,
  ): Promise<ProviderServiceSnapshot | null> {
    const row = await this.db.providerService.findUnique({
      where: {
        providerId_catalogServiceId: { providerId, catalogServiceId },
      },
      select: OFFERING_SELECT,
    });
    return row === null ? null : mapOffering(row);
  }

  /**
   * @desc List offerings for a Provider with chronological cursor paging.
   * @access Infrastructure
   */
  public async listOfferings(
    providerId: string,
    page: ProviderServiceCursorPage,
  ): Promise<readonly ProviderServiceSnapshot[]> {
    const rows = await this.db.providerService.findMany({
      where: applyChronologicalCursor({ providerId }, page),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.max(1, page.limit),
      select: OFFERING_SELECT,
    });
    return rows.map(mapOffering);
  }

  /**
   * @desc Insert a new disabled offering at aggregate version 1.
   * @access Infrastructure
   */
  public async createOffering(
    input: CreateProviderServiceOfferingInput,
  ): Promise<ProviderServiceSnapshot> {
    try {
      const row = await this.db.providerService.create({
        data: {
          id: input.providerServiceId,
          providerId: input.providerId,
          catalogServiceId: input.catalogServiceId,
          enabled: false,
          estimatedDurationMinutes: input.estimatedDurationMinutes,
          noteAr: input.notes.noteAr,
          noteEn: input.notes.noteEn,
          version: 1,
        },
        select: OFFERING_SELECT,
      });
      return mapOffering(row);
    } catch (error: unknown) {
      rethrowMapped(error);
    }
  }

  /**
   * @desc Compare-and-set configuration fields and increment aggregate version.
   * @access Infrastructure
   */
  public async updateConfiguration(
    input: UpdateProviderServiceConfigurationInput,
  ): Promise<ProviderServiceSnapshot> {
    const updated = await this.db.providerService.updateMany({
      where: {
        id: input.providerServiceId,
        providerId: input.providerId,
        version: input.expectedVersion,
      },
      data: {
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        noteAr: input.notes.noteAr,
        noteEn: input.notes.noteEn,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw providerServiceStaleVersionError();
    }
    const row = await this.findOffering(input.providerId, input.providerServiceId);
    if (row === null) {
      throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
    }
    return row;
  }

  /**
   * @desc Compare-and-set enabled flag and increment aggregate version.
   * @access Infrastructure
   */
  public async setEnabled(
    input: SetProviderServiceEnabledInput,
  ): Promise<ProviderServiceSnapshot> {
    const updated = await this.db.providerService.updateMany({
      where: {
        id: input.providerServiceId,
        providerId: input.providerId,
        version: input.expectedVersion,
      },
      data: {
        enabled: input.enabled,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw providerServiceStaleVersionError();
    }
    const row = await this.findOffering(input.providerId, input.providerServiceId);
    if (row === null) {
      throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
    }
    return row;
  }

  /**
   * @desc Compare-and-increment aggregate version without other field changes.
   * @access Infrastructure
   * @explanation Zero affected rows return null so the service maps the stale
   * version conflict without mutating history or receipts.
   */
  public async bumpAggregateVersion(input: {
    readonly providerId: string;
    readonly providerServiceId: string;
    readonly expectedVersion: number;
  }): Promise<ProviderServiceSnapshot | null> {
    const updated = await this.db.providerService.updateMany({
      where: {
        id: input.providerServiceId,
        providerId: input.providerId,
        version: input.expectedVersion,
      },
      data: {
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return null;
    }
    return this.findOffering(input.providerId, input.providerServiceId);
  }

  /**
   * @desc Load one retained price proposal.
   * @access Infrastructure
   */
  public async findPrice(
    providerId: string,
    providerServiceId: string,
    providerServicePriceId: string,
  ): Promise<ProviderServicePriceSnapshot | null> {
    const row = await this.db.providerServicePrice.findFirst({
      where: {
        id: providerServicePriceId,
        providerId,
        providerServiceId,
      },
      select: PRICE_SELECT,
    });
    return row === null ? null : mapPrice(row);
  }

  /**
   * @desc Load the sole current EFFECTIVE price for an offering.
   * @access Infrastructure
   */
  public async findCurrentEffectivePrice(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServicePriceSnapshot | null> {
    const row = await this.db.providerServicePrice.findFirst({
      where: {
        providerId,
        providerServiceId,
        status: "EFFECTIVE",
      },
      select: PRICE_SELECT,
    });
    return row === null ? null : mapPrice(row);
  }

  /**
   * @desc Load the sole current PENDING price for an offering.
   * @access Infrastructure
   */
  public async findCurrentPendingPrice(
    providerId: string,
    providerServiceId: string,
  ): Promise<ProviderServicePriceSnapshot | null> {
    const row = await this.db.providerServicePrice.findFirst({
      where: {
        providerId,
        providerServiceId,
        status: "PENDING",
      },
      select: PRICE_SELECT,
    });
    return row === null ? null : mapPrice(row);
  }

  /**
   * @desc Insert a retained price proposal with Decimal minor-unit amounts.
   * @access Infrastructure
   */
  public async createPrice(
    input: CreateProviderServicePriceInput,
  ): Promise<ProviderServicePriceSnapshot> {
    try {
      const row = await this.db.providerServicePrice.create({
        data: {
          id: input.id,
          providerId: input.providerId,
          providerServiceId: input.providerServiceId,
          catalogServiceId: input.catalogServiceId,
          catalogPriceUnitId: input.catalogPriceUnitId,
          priceUnitCodeAtProposal: input.priceUnitCodeAtProposal,
          countryIdAtProposal: input.countryIdAtProposal,
          countryCodeAtProposal: input.countryCodeAtProposal,
          currencyId: input.currencyId,
          currencyCode: input.currencyCode,
          currencyDecimalPlaces: input.currencyDecimalPlaces,
          providerPriceMinorUnits: decimalFromMinorUnits(
            input.providerPriceMinorUnits,
          ),
          minimumChargeMinorUnits: decimalFromMinorUnits(
            input.minimumChargeMinorUnits,
          ),
          maximumPriceMinorUnitsAtProposal: decimalFromMinorUnits(
            input.maximumPriceMinorUnitsAtProposal,
          ),
          approvalRequiredAtProposal: input.approvalRequiredAtProposal,
          status: input.status,
          proposedByUserId: input.proposedByUserId,
          effectiveAt: input.effectiveAt,
          rejectedAt: null,
          supersededAt: null,
          createdAt: input.createdAt,
        },
        select: PRICE_SELECT,
      });
      return mapPrice(row);
    } catch (error: unknown) {
      rethrowMapped(error);
    }
  }

  /**
   * @desc Advance a price lifecycle status and its transition timestamp.
   * @access Infrastructure
   */
  public async transitionPriceStatus(
    input: TransitionProviderServicePriceInput,
  ): Promise<ProviderServicePriceSnapshot> {
    const timestampData: {
      effectiveAt?: Date;
      rejectedAt?: Date;
      supersededAt?: Date;
    } =
      input.toStatus === "EFFECTIVE"
        ? { effectiveAt: input.transitionedAt }
        : input.toStatus === "REJECTED"
          ? { rejectedAt: input.transitionedAt }
          : { supersededAt: input.transitionedAt };

    const updated = await this.db.providerServicePrice.updateMany({
      where: {
        id: input.providerServicePriceId,
        providerId: input.providerId,
        providerServiceId: input.providerServiceId,
        status: input.fromStatus,
      },
      data: {
        status: input.toStatus,
        ...timestampData,
      },
    });
    if (updated.count !== 1) {
      throw new ProviderServiceError(
        "PROVIDER_SERVICE_PRICE_TRANSITION_ILLEGAL",
        undefined,
        { details: { reason: "STATUS_TRANSITION_MISMATCH" } },
      );
    }
    const row = await this.findPrice(
      input.providerId,
      input.providerServiceId,
      input.providerServicePriceId,
    );
    if (row === null) {
      throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
    }
    return row;
  }

  /**
   * @desc List retained prices for an offering with chronological paging.
   * @access Infrastructure
   */
  public async listPricesForOffering(
    providerId: string,
    providerServiceId: string,
    page: ProviderServiceCursorPage,
  ): Promise<readonly ProviderServicePriceSnapshot[]> {
    const rows = await this.db.providerServicePrice.findMany({
      where: applyChronologicalCursor(
        { providerId, providerServiceId },
        page,
      ),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.max(1, page.limit),
      select: PRICE_SELECT,
    });
    return rows.map(mapPrice);
  }

  /**
   * @desc List PENDING prices for Staff queue reads with optional filters.
   * @access Infrastructure
   * @explanation Joins offering version and safe Provider display names only;
   * contacts and audit internals stay out of the persistence projection.
   */
  public async listPendingPricesForStaff(
    page: ProviderServiceCursorPage & {
      readonly providerId?: string;
      readonly countryCode?: string;
    },
  ): Promise<readonly StaffPendingPricePersistenceRow[]> {
    const rows = await this.db.providerServicePrice.findMany({
      where: applyChronologicalCursor(
        {
          status: "PENDING" as const,
          ...(page.providerId === undefined
            ? {}
            : { providerId: page.providerId }),
          ...(page.countryCode === undefined
            ? {}
            : { countryCodeAtProposal: page.countryCode }),
        },
        page,
      ),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.max(1, page.limit),
      select: {
        ...PRICE_SELECT,
        providerService: {
          select: { version: true },
        },
        provider: {
          select: {
            profile: {
              select: {
                displayNameAr: true,
                displayNameEn: true,
              },
            },
          },
        },
      },
    });
    return rows.map((row) => ({
      price: mapPrice(row),
      offeringVersion: row.providerService.version,
      providerDisplayNameAr: row.provider.profile?.displayNameAr ?? null,
      providerDisplayNameEn: row.provider.profile?.displayNameEn ?? null,
    }));
  }

  /**
   * @desc Look up a durable command receipt from price or status history.
   * @access Infrastructure
   */
  public async findReceipt(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
  }): Promise<ProviderServiceReceiptLookup | null> {
    const statusRow = await this.db.providerServiceStatusHistory.findFirst({
      where: {
        scopeKey: input.scopeKey,
        idempotencyKey: input.idempotencyKey,
      },
      select: STATUS_HISTORY_SELECT,
    });
    if (statusRow !== null) {
      return {
        scopeKey: statusRow.scopeKey,
        idempotencyKey: statusRow.idempotencyKey,
        requestFingerprint: statusRow.requestFingerprint,
        safeResultCode: statusRow.safeResultCode,
        safeResultJson: asSafeJsonObject(statusRow.safeResultJson),
        aggregateVersion: statusRow.aggregateVersion,
        source: "STATUS_HISTORY",
        historyId: statusRow.id,
      };
    }

    const priceRow = await this.db.providerServicePriceHistory.findFirst({
      where: {
        scopeKey: input.scopeKey,
        idempotencyKey: input.idempotencyKey,
      },
      select: PRICE_HISTORY_SELECT,
    });
    if (
      priceRow === null ||
      priceRow.scopeKey === null ||
      priceRow.idempotencyKey === null ||
      priceRow.requestFingerprint === null ||
      priceRow.safeResultCode === null ||
      priceRow.safeResultJson === null
    ) {
      return null;
    }
    return {
      scopeKey: priceRow.scopeKey,
      idempotencyKey: priceRow.idempotencyKey,
      requestFingerprint: priceRow.requestFingerprint,
      safeResultCode: priceRow.safeResultCode,
      safeResultJson: asSafeJsonObject(priceRow.safeResultJson),
      aggregateVersion: priceRow.aggregateVersion,
      source: "PRICE_HISTORY",
      historyId: priceRow.id,
    };
  }

  /**
   * @desc Append an immutable price history / receipt row.
   * @access Infrastructure
   */
  public async appendPriceHistory(
    input: ProviderServicePriceHistoryInput,
  ): Promise<ProviderServicePriceHistorySnapshot> {
    try {
      const row = await this.db.providerServicePriceHistory.create({
        data: {
          providerId: input.providerId,
          providerServiceId: input.providerServiceId,
          providerServicePriceId: input.providerServicePriceId,
          event: input.event,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          actorUserId: input.actorUserId,
          reasonCode: input.reasonCode,
          reasonText: input.reasonText,
          safeBefore:
            input.safeBefore === null
              ? Prisma.DbNull
              : (input.safeBefore as Prisma.InputJsonValue),
          safeAfter: input.safeAfter as Prisma.InputJsonValue,
          requestId: input.requestId,
          aggregateVersion: input.aggregateVersion,
          scopeKey: input.receipt.scopeKey,
          idempotencyKey: input.receipt.idempotencyKey,
          requestFingerprint: input.receipt.requestFingerprint,
          safeResultCode: input.receipt.safeResultCode,
          safeResultJson:
            input.receipt.safeResultJson === null
              ? Prisma.DbNull
              : (input.receipt.safeResultJson as Prisma.InputJsonValue),
          operationKey: input.operationKey,
        },
        select: PRICE_HISTORY_SELECT,
      });
      return mapPriceHistory(row);
    } catch (error: unknown) {
      rethrowMapped(error);
    }
  }

  /**
   * @desc Append an immutable status history / receipt row.
   * @access Infrastructure
   */
  public async appendStatusHistory(
    input: ProviderServiceStatusHistoryInput,
  ): Promise<ProviderServiceStatusHistorySnapshot> {
    try {
      const row = await this.db.providerServiceStatusHistory.create({
        data: {
          providerId: input.providerId,
          providerServiceId: input.providerServiceId,
          event: input.event,
          fromEnabled: input.fromEnabled,
          toEnabled: input.toEnabled,
          actorUserId: input.actorUserId,
          reasonCode: input.reasonCode,
          reasonText: input.reasonText,
          safeBefore:
            input.safeBefore === null
              ? Prisma.DbNull
              : (input.safeBefore as Prisma.InputJsonValue),
          safeAfter: input.safeAfter as Prisma.InputJsonValue,
          requestId: input.requestId,
          aggregateVersion: input.aggregateVersion,
          scopeKey: input.receipt.scopeKey,
          idempotencyKey: input.receipt.idempotencyKey,
          requestFingerprint: input.receipt.requestFingerprint,
          safeResultCode: input.receipt.safeResultCode,
          safeResultJson: input.receipt.safeResultJson as Prisma.InputJsonValue,
          operationKey: input.operationKey,
        },
        select: STATUS_HISTORY_SELECT,
      });
      return mapStatusHistory(row);
    } catch (error: unknown) {
      rethrowMapped(error);
    }
  }

  /**
   * @desc List price history rows with chronological cursor paging.
   * @access Infrastructure
   */
  public async listPriceHistory(input: {
    readonly providerId: string;
    readonly providerServiceId: string;
    readonly page: ProviderServiceCursorPage;
  }): Promise<readonly ProviderServicePriceHistorySnapshot[]> {
    const rows = await this.db.providerServicePriceHistory.findMany({
      where: applyChronologicalCursor(
        {
          providerId: input.providerId,
          providerServiceId: input.providerServiceId,
        },
        input.page,
      ),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.max(1, input.page.limit),
      select: PRICE_HISTORY_SELECT,
    });
    return rows.map(mapPriceHistory);
  }

  /**
   * @desc List management-visible enable/disable status history only.
   * @access Infrastructure
   */
  public async listManagementStatusHistory(input: {
    readonly providerId: string;
    readonly providerServiceId: string;
    readonly page: ProviderServiceCursorPage;
  }): Promise<readonly ProviderServiceStatusHistorySnapshot[]> {
    const rows = await this.db.providerServiceStatusHistory.findMany({
      where: applyChronologicalCursor(
        {
          providerId: input.providerId,
          providerServiceId: input.providerServiceId,
          event: {
            in: [...PROVIDER_SERVICE_MANAGEMENT_STATUS_EVENTS],
          },
        },
        input.page,
      ),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.max(1, input.page.limit),
      select: STATUS_HISTORY_SELECT,
    });
    return rows.map(mapStatusHistory);
  }

  /**
   * @desc Bound readiness projection: offerings plus current EFFECTIVE/PENDING.
   * @access Infrastructure
   */
  public async listReadinessProjections(
    providerId: string,
  ): Promise<readonly ProviderServiceReadinessProjection[]> {
    const rows = await this.db.providerService.findMany({
      where: { providerId },
      orderBy: [{ id: "asc" }],
      select: {
        ...OFFERING_SELECT,
        prices: {
          where: {
            status: { in: ["EFFECTIVE", "PENDING"] },
          },
          select: PRICE_SELECT,
        },
      },
    });

    return rows.map((row) => {
      const effective = row.prices.find((price) => price.status === "EFFECTIVE");
      const pending = row.prices.find((price) => price.status === "PENDING");
      return {
        providerServiceId: row.id,
        catalogServiceId: row.catalogServiceId,
        enabled: row.enabled,
        estimatedDurationMinutes: row.estimatedDurationMinutes,
        noteAr: row.noteAr,
        noteEn: row.noteEn,
        version: row.version,
        effectivePrice: effective === undefined ? null : mapPrice(effective),
        pendingPrice: pending === undefined ? null : mapPrice(pending),
      };
    });
  }

  /**
   * @desc Find an enabled offering that currently has an EFFECTIVE price.
   * @access Infrastructure
   */
  public async findEnabledOfferingWithEffectivePrice(input: {
    readonly providerId: string;
    readonly catalogServiceId: string;
  }): Promise<{
    readonly offering: ProviderServiceSnapshot;
    readonly effectivePrice: ProviderServicePriceSnapshot;
  } | null> {
    const row = await this.db.providerService.findFirst({
      where: {
        providerId: input.providerId,
        catalogServiceId: input.catalogServiceId,
        enabled: true,
      },
      select: {
        ...OFFERING_SELECT,
        prices: {
          where: { status: "EFFECTIVE" },
          select: PRICE_SELECT,
          take: 1,
        },
      },
    });
    if (row === null) {
      return null;
    }
    const effective = row.prices[0];
    if (effective === undefined) {
      return null;
    }
    return {
      offering: mapOffering(row),
      effectivePrice: mapPrice(effective),
    };
  }
}
