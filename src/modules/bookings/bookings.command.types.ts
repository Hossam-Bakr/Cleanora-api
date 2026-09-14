import { createHash } from "node:crypto";

import type { BookingStatusName } from "./bookings.matrix.js";
import type { BookingQuote } from "./bookings.quote.js";

export interface BookingAnswerRecord {
  readonly fieldId: string;
  readonly fieldCode: string;
  readonly kind: string;
  readonly value: unknown;
}

export interface BookingAddressRecord {
  readonly sourceUserAddressId: string;
  readonly countryCode: string;
  readonly cityId: string;
  readonly districtId: string | null;
  readonly cityLabel: string;
  readonly districtLabel: string;
  readonly addressText: string;
  readonly building: string | null;
  readonly floor: string | null;
  readonly notes: string | null;
}

export interface BookingItemRecord {
  readonly catalogServiceId: string;
  readonly catalogServiceCode: string;
  readonly catalogServiceVersion: number;
  readonly providerServiceId: string;
  readonly providerServiceVersion: number;
  readonly providerServicePriceId: string;
  readonly estimatedDurationMinutes: number;
}

export interface BookingMediaRecord {
  readonly mediaId: string;
  readonly displayOrder: number;
  readonly deliveryUrl?: string;
  readonly urlExpiresAt?: string;
}

export interface BookingHistoryRecord {
  readonly fromStatus: string;
  readonly toStatus: BookingStatusName;
  readonly actorType: string;
  readonly reasonCode: string | null;
  readonly createdAt: string;
}

export interface BookingSnapshotRecord {
  readonly catalog: unknown;
  readonly provider: unknown;
  readonly frozenAt: string;
}

export interface BookingPriceBreakdownRecord {
  readonly gross: string;
  readonly deposit: string;
  readonly remainder: string;
  readonly currencyCode: string;
  readonly decimalPlaces: number;
  readonly depositPercent: string;
  readonly formulaVersion: string;
  readonly createdAt: string;
}

export interface BookingAggregate {
  readonly id: string;
  readonly customerUserId: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly status: BookingStatusName;
  readonly serviceId: string;
  readonly providerId: string;
  readonly teamId: string;
  readonly cityId: string;
  readonly districtId: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly crewPreference: "all_male" | "all_female" | "any";
  readonly requiredTeamUnits: number;
  readonly locale: "AR" | "EN";
  readonly notes: string | null;
  readonly emergencySignaled: boolean;
  readonly version: number;
  readonly depositPercent: string;
  readonly quote: BookingQuote | null;
  readonly eligibilityEvaluationId: string | null;
  readonly item: BookingItemRecord | null;
  readonly address: BookingAddressRecord | null;
  readonly answers: readonly BookingAnswerRecord[];
  readonly media: readonly BookingMediaRecord[];
  readonly statusHistory: readonly BookingHistoryRecord[];
  readonly snapshot: BookingSnapshotRecord | null;
  readonly priceBreakdown: BookingPriceBreakdownRecord | null;
  readonly snapshotFrozen: boolean;
  readonly cancelledAt: string | null;
  readonly submittedAt: string | null;
  readonly createdAt: string;
}

export interface CreateDraftInput {
  readonly customerUserId: string;
  readonly countryId: string;
  readonly currencyCode: string;
  readonly currencyDecimalPlaces: number;
  readonly serviceId: string;
  readonly providerId: string;
  readonly teamId: string;
  readonly cityId: string;
  readonly districtId: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly crewPreference: "ALL_MALE" | "ALL_FEMALE" | "ANY";
  readonly requiredTeamUnits: number;
  readonly locale: "AR" | "EN";
  readonly notes: string | null;
  readonly depositPercent: string;
  readonly eligibilityEvaluationId: string | null;
  readonly quote: BookingQuote;
  readonly item: BookingItemRecord;
  readonly address: BookingAddressRecord;
  readonly answers: readonly BookingAnswerRecord[];
  readonly command: BookingCommandWrite;
}

export interface BookingCommandRecord {
  readonly requestHash: string;
  readonly bookingId: string | null;
  readonly responseJson: unknown;
}

export type BookingCommandTypeName =
  "CREATE" | "SUBMIT_FOR_DEPOSIT" | "CANCEL" | "ATTACH_MEDIA";

export interface BookingCommandWrite {
  readonly customerUserId: string;
  readonly commandType: BookingCommandTypeName;
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

/** Thrown when the idempotency unique key is already reserved in another transaction. */
export class BookingIdempotencyCollision extends Error {
  public constructor() {
    super("BOOKING_IDEMPOTENCY_COLLISION");
    this.name = "BookingIdempotencyCollision";
  }
}

/** Thrown when `status_transition_rules` does not authorize the requested transition. */
export class BookingTransitionUnavailable extends Error {
  public constructor() {
    super("TRANSITION_NOT_AVAILABLE");
    this.name = "BookingTransitionUnavailable";
  }
}

export function presentBooking(
  booking: BookingAggregate,
): Record<string, unknown> {
  return {
    id: booking.id,
    status: booking.status,
    path: "BROWSE",
    version: booking.version,
    serviceId: booking.serviceId,
    providerId: booking.providerId,
    teamId: booking.teamId,
    countryId: booking.countryId,
    cityId: booking.cityId,
    districtId: booking.districtId,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    crewPreference: booking.crewPreference,
    requiredTeamUnits: booking.requiredTeamUnits,
    locale: booking.locale,
    notes: booking.notes,
    emergencySignaled: booking.emergencySignaled,
    quote:
      booking.quote === null
        ? null
        : {
            gross: booking.quote.gross,
            deposit: booking.quote.deposit,
            remainder: booking.quote.remainder,
            currencyCode: booking.quote.currencyCode,
            depositPercent: booking.quote.depositPercent,
            formulaVersion: booking.quote.formulaVersion,
          },
    item: booking.item,
    address: booking.address,
    answers: booking.answers,
    media: booking.media,
    snapshot: booking.snapshot,
    priceBreakdown: booking.priceBreakdown,
    snapshotFrozen: booking.snapshotFrozen,
    eligibilityEvaluationId: booking.eligibilityEvaluationId,
    statusHistory: booking.statusHistory,
    createdAt: booking.createdAt,
    submittedAt: booking.submittedAt,
    cancelledAt: booking.cancelledAt,
  };
}

export interface BookingsCommandRepository {
  isExecutableTransition(input: {
    readonly actor: "CUSTOMER";
    readonly from: "NONE" | BookingStatusName;
    readonly to: BookingStatusName;
  }): Promise<boolean>;
  findCommand(input: {
    readonly customerUserId: string;
    readonly commandType: BookingCommandTypeName;
    readonly idempotencyKey: string;
  }): Promise<BookingCommandRecord | null>;
  createDraft(input: CreateDraftInput): Promise<BookingAggregate>;
  findOwned(input: {
    readonly bookingId: string;
    readonly customerUserId: string;
  }): Promise<BookingAggregate | null>;
  listOwned(input: {
    readonly customerUserId: string;
    readonly limit: number;
    readonly cursor?: string;
    readonly status?: BookingStatusName;
  }): Promise<{
    readonly items: readonly BookingAggregate[];
    readonly nextCursor: string | null;
  }>;
  replaceDraftContents(input: {
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly expectedVersion: number;
    readonly notes: string | null;
    readonly address: BookingAddressRecord | null;
    readonly answers: readonly BookingAnswerRecord[] | null;
  }): Promise<BookingAggregate | "NOT_FOUND" | "CONFLICT" | "NOT_DRAFT">;
  attachMedia(input: {
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly expectedVersion: number;
    readonly mediaId: string;
    readonly command: BookingCommandWrite;
  }): Promise<
    BookingAggregate | "NOT_FOUND" | "CONFLICT" | "NOT_DRAFT" | "LIMIT"
  >;
  submitForDeposit(input: {
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly expectedVersion: number;
    readonly eligibilityEvaluationId: string | null;
    readonly quote: BookingQuote;
    readonly catalogSnapshot: unknown;
    readonly providerSnapshot: unknown;
    readonly catalogHash: string;
    readonly providerHash: string;
    readonly priceInputHash: string;
    readonly command: BookingCommandWrite;
  }): Promise<BookingAggregate | "NOT_FOUND" | "CONFLICT" | "NOT_DRAFT">;
  cancel(input: {
    readonly bookingId: string;
    readonly customerUserId: string;
    readonly expectedVersion: number;
    readonly reason: string;
    readonly requestId?: string;
    readonly command: BookingCommandWrite;
  }): Promise<BookingAggregate | "NOT_FOUND" | "CONFLICT" | "NOT_CANCELLABLE">;
  recordCompletedCommand(input: {
    readonly command: BookingCommandWrite;
    readonly bookingId: string;
    readonly aggregate: BookingAggregate;
  }): Promise<void>;
}

/**
 * @desc Stable SHA-256 of a canonical JSON request body for idempotency.
 * @access Bookings module
 */
export function hashBookingRequest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}
