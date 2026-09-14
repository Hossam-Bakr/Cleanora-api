import { createHash } from "node:crypto";

import { bookingError } from "./bookings.errors.js";
import {
  BookingIdempotencyCollision,
  hashBookingRequest,
} from "./bookings.command.types.js";
import type { BookingStatusName } from "./bookings.matrix.js";

type StoreDelegate = {
  findUnique: (args: unknown) => Promise<any>;
  findFirst: (args: unknown) => Promise<any>;
  findMany: (args: unknown) => Promise<any[]>;
  create: (args: unknown) => Promise<any>;
  update: (args: unknown) => Promise<any>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  upsert: (args: unknown) => Promise<any>;
};

type BookingTx = {
  booking: StoreDelegate;
  bookingResponse: StoreDelegate;
  cancellationReason: StoreDelegate;
  statusTransitionRule: StoreDelegate;
  bookingStatusHistory: StoreDelegate;
  bookingCancellation: StoreDelegate;
  bookingNotificationIntent: StoreDelegate;
  bookingActorCommand: StoreDelegate;
  bookingCommand: StoreDelegate;
};

type BookingStore = BookingTx & {
  $transaction: <T>(work: (tx: BookingTx) => Promise<T>) => Promise<T>;
};

export type BookingManagerLevel = "OWNER" | "ADMIN";

export interface BookingResponseServiceDependencies {
  readonly client?: unknown;
  readonly now: () => Date;
  readonly readResponseHours: (countryId: string) => Promise<number | null>;
  readonly assertActiveProviderManager: (
    providerId: string,
    userId: string,
  ) => Promise<{ readonly providerId: string; readonly userId: string; readonly level: BookingManagerLevel }>;
  readonly resolveProviderOwnerUserId: (providerId: string) => Promise<string | null>;
  readonly isStaffAdmin: (userId: string) => Promise<boolean>;
}

export interface InboxItem {
  readonly bookingId: string;
  readonly status: "CONFIRMED";
  readonly startsAt: string;
  readonly endsAt: string;
  readonly responseStatus: "PENDING";
  readonly expiresAt: string;
  readonly version: number;
  readonly serviceLabel: string | null;
}

export interface BookingDossier {
  readonly bookingId: string;
  readonly status: BookingStatusName;
  readonly providerId: string;
  readonly customerUserId: string;
  readonly serviceId: string;
  readonly service: {
    readonly catalogServiceCode: string;
    readonly catalogServiceVersion: number;
  } | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly addressText: string | null;
  readonly crewPreference: string;
  readonly version: number;
  readonly quote: {
    readonly gross: string;
    readonly deposit: string;
    readonly remainder: string;
    readonly currencyCode: string;
  } | null;
  readonly response: {
    readonly status: string;
    readonly expiresAt: string;
    readonly decidedAt: string | null;
  } | null;
  readonly cancellation: {
    readonly actorKind: string;
    readonly reasonCode: string;
    readonly createdAt: string;
  } | null;
}

function isExpiredResponse(row: { readonly status?: string } | null): boolean {
  return row !== null && row.status === "EXPIRED";
}

function isPendingResponse(row: { readonly status?: string } | null): boolean {
  return row !== null && row.status === "PENDING";
}

function canCancelAfterConfirm(status: string): boolean {
  return status === "CONFIRMED" || status === "ACCEPTED";
}

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }
  return (error as { code?: string }).code === "CONFLICT";
}

function isUniqueCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return (error as { code?: string }).code === "P2002";
}

function notifyRecipient(ownerUserId: string | null, customerUserId: string): string {
  if (ownerUserId === null) {
    return customerUserId;
  } else {
    return ownerUserId;
  }
}

function isoOrNull(value: Date | null): string | null {
  if (value === null) {
    return null;
  } else {
    return value.toISOString();
  }
}

function quoteProjection(
  priceBreakdown: {
    readonly grossMinorUnits: { toFixed(digits: number): string };
    readonly depositMinorUnits: { toFixed(digits: number): string };
    readonly remainderMinorUnits: { toFixed(digits: number): string };
    readonly currencyCode: string;
  } | null,
): BookingDossier["quote"] {
  if (priceBreakdown === null) {
    return null;
  } else {
    return {
      gross: priceBreakdown.grossMinorUnits.toFixed(0),
      deposit: priceBreakdown.depositMinorUnits.toFixed(0),
      remainder: priceBreakdown.remainderMinorUnits.toFixed(0),
      currencyCode: priceBreakdown.currencyCode,
    };
  }
}

function responseProjection(
  response: {
    readonly status: string;
    readonly expiresAt: Date;
    readonly decidedAt: Date | null;
  } | null,
): BookingDossier["response"] {
  if (response === null) {
    return null;
  } else {
    return {
      status: response.status,
      expiresAt: response.expiresAt.toISOString(),
      decidedAt: isoOrNull(response.decidedAt),
    };
  }
}

function cancellationProjection(
  cancellation: {
    readonly actorKind: string;
    readonly reason: { readonly code: string };
    readonly createdAt: Date;
  } | null,
): BookingDossier["cancellation"] {
  if (cancellation === null) {
    return null;
  } else {
    return {
      actorKind: cancellation.actorKind,
      reasonCode: cancellation.reason.code,
      createdAt: cancellation.createdAt.toISOString(),
    };
  }
}

function failWhen(condition: boolean, error: () => Error): asserts condition is false {
  if (condition) {
    throw error();
  } else {
    return;
  }
}

function requirePresent<T>(value: T | null, error: () => Error): T {
  if (value === null) {
    throw error();
  } else {
    return value;
  }
}

function clientOf(dependencies: BookingResponseServiceDependencies): BookingStore {
  if (dependencies.client === undefined) {
    throw bookingError("DEPENDENCY_FAILURE", { reason: "BOOKING_STORE" });
  } else {
    return dependencies.client as BookingStore;
  }
}

function requestHashOf(value: unknown): string {
  return hashBookingRequest(value);
}

function shaIdempotency(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

function frozenService(
  items:
    | readonly { readonly catalogServiceCode?: string; readonly catalogServiceVersion?: number }[]
    | null
    | undefined,
): { readonly catalogServiceCode: string; readonly catalogServiceVersion: number } | null {
  const item = items?.[0];
  if (
    item === undefined ||
    typeof item.catalogServiceCode !== "string" ||
    typeof item.catalogServiceVersion !== "number"
  ) {
    return null;
  }
  return {
    catalogServiceCode: item.catalogServiceCode,
    catalogServiceVersion: item.catalogServiceVersion,
  };
}

function customerCancelReasonCode(reason: string): string {
  if (reason === "OTHER") {
    return "CUSTOMER_CANCEL_OTHER";
  } else {
    return reason;
  }
}

/**
 * @desc Provider inbox, accept/reject, lazy expiry, and cancellation commands.
 * @access Bookings application
 */
export class BookingResponseService {
  public constructor(private readonly deps: BookingResponseServiceDependencies) {}

  public async listInbox(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly limit: number;
  }): Promise<{ readonly items: readonly InboxItem[]; readonly nextCursor: null }> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    const db = clientOf(this.deps);
    const now = this.deps.now();
    for (;;) {
      const overdue = await db.bookingResponse.findMany({
        where: {
          providerId: input.providerId,
          status: "PENDING",
          expiresAt: { lte: now },
          booking: { status: "CONFIRMED", providerId: input.providerId },
        },
        select: { bookingId: true },
        take: 50,
      });
      if (overdue.length === 0) {
        break;
      }
      let expiredCount = 0;
      for (const row of overdue) {
        if (await this.expireIfPending(row.bookingId)) {
          expiredCount += 1;
        }
      }
      if (expiredCount === 0) {
        break;
      }
    }
    const live = await db.bookingResponse.findMany({
      where: {
        providerId: input.providerId,
        status: "PENDING",
        expiresAt: { gt: now },
        booking: { status: "CONFIRMED", providerId: input.providerId },
      },
      include: { booking: { include: { items: true } } },
      orderBy: { expiresAt: "asc" },
      take: input.limit,
    });
    return {
      items: live.map((row) => ({
        bookingId: row.bookingId,
        status: "CONFIRMED" as const,
        startsAt: row.booking.startsAt.toISOString(),
        endsAt: row.booking.endsAt.toISOString(),
        responseStatus: "PENDING" as const,
        expiresAt: row.expiresAt.toISOString(),
        version: row.booking.version,
        serviceLabel: frozenService(row.booking.items)?.catalogServiceCode ?? null,
      })),
      nextCursor: null,
    };
  }

  public async getProviderDossier(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
  }): Promise<BookingDossier> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    await this.expireIfPending(input.bookingId);
    const dossier = requirePresent(
      await this.loadDossier(input.bookingId),
      () => bookingError("NOT_FOUND"),
    );
    failWhen(dossier.providerId !== input.providerId, () => bookingError("NOT_FOUND"));
    return dossier;
  }

  public async peekDossier(bookingId: string): Promise<BookingDossier | null> {
    await this.expireIfPending(bookingId);
    return this.loadDossier(bookingId);
  }

  public async getStaffDossier(input: {
    readonly actorUserId: string;
    readonly bookingId: string;
  }): Promise<BookingDossier> {
    failWhen(!(await this.deps.isStaffAdmin(input.actorUserId)), () => bookingError("FORBIDDEN"));
    await this.expireIfPending(input.bookingId);
    return requirePresent(
      await this.loadDossier(input.bookingId),
      () => bookingError("NOT_FOUND"),
    );
  }

  public async listReasons(input: {
    readonly actor: "CUSTOMER" | "PROVIDER" | "STAFF_ADMIN";
    readonly purpose: "REJECT" | "CANCEL";
  }): Promise<readonly { readonly code: string; readonly labelAr: string; readonly labelEn: string }[]> {
    const db = clientOf(this.deps);
    const rows = await db.cancellationReason.findMany({
      where: { actor: input.actor, purpose: input.purpose, active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((row) => ({
      code: row.code,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
    }));
  }

  public async accept(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly version: number;
    readonly idempotencyKey: string;
  }): Promise<{ readonly bookingId: string; readonly status: "ACCEPTED"; readonly version: number; readonly responseStatus: "ACCEPTED" }> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    await this.expireIfPending(input.bookingId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "ACCEPT",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: { bookingId: input.bookingId, version: input.version, providerId: input.providerId },
      run: async (tx) => {
        await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
        const expired = await tx.bookingResponse.findUnique({
          where: { bookingId: input.bookingId },
        });
        failWhen(isExpiredResponse(expired), () => bookingError("RESPONSE_EXPIRED"));
        const booking = await this.requireProviderBooking(tx, input.bookingId, input.providerId);
        failWhen(booking.status !== "CONFIRMED", () => bookingError("TRANSITION_NOT_AVAILABLE"));
        failWhen(booking.version !== input.version, () => bookingError("CONFLICT"));
        await this.requireRule(tx, "PROVIDER", "CONFIRMED", "ACCEPTED");
        const response = await tx.bookingResponse.findUnique({ where: { bookingId: input.bookingId } });
        failWhen(!isPendingResponse(response), () => bookingError("TRANSITION_NOT_AVAILABLE"));
        failWhen(response.expiresAt.getTime() <= this.deps.now().getTime(), () => bookingError("RESPONSE_EXPIRED"));
        const claimed = await tx.booking.updateMany({
          where: { id: input.bookingId, status: "CONFIRMED", version: input.version },
          data: { status: "ACCEPTED", version: { increment: 1 } },
        });
        failWhen(claimed.count !== 1, () => bookingError("CONFLICT"));
        await tx.bookingResponse.update({
          where: { bookingId: input.bookingId },
          data: {
            status: "ACCEPTED",
            decidedAt: this.deps.now(),
            decidedByUserId: input.actorUserId,
          },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: input.bookingId,
            fromStatus: "CONFIRMED",
            toStatus: "ACCEPTED",
            actorUserId: input.actorUserId,
            actorType: "PROVIDER",
            reasonCode: "PROVIDER_ACCEPTED",
          },
        });
        await this.insertIntent(tx, {
          bookingId: input.bookingId,
          template: "BOOKING_ACCEPTED",
          recipientUserId: booking.customerUserId,
          locale: booking.locale,
          idempotencyKey: shaIdempotency(["BOOKING_ACCEPTED", input.bookingId]),
        });
        return {
          bookingId: input.bookingId,
          status: "ACCEPTED" as const,
          version: input.version + 1,
          responseStatus: "ACCEPTED" as const,
        };
      },
    });
  }

  public async reject(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly version: number;
    readonly reasonCode: string;
    readonly idempotencyKey: string;
  }): Promise<{
    readonly bookingId: string;
    readonly status: "CANCELLED";
    readonly version: number;
    readonly responseStatus: "REJECTED";
    readonly cancellationId: string;
  }> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    await this.expireIfPending(input.bookingId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "REJECT",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        version: input.version,
        providerId: input.providerId,
        reasonCode: input.reasonCode,
      },
      run: async (tx) => {
        await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
        const expired = await tx.bookingResponse.findUnique({
          where: { bookingId: input.bookingId },
        });
        failWhen(isExpiredResponse(expired), () => bookingError("RESPONSE_EXPIRED"));
        const booking = await this.requireProviderBooking(tx, input.bookingId, input.providerId);
        failWhen(booking.status !== "CONFIRMED", () => bookingError("TRANSITION_NOT_AVAILABLE"));
        failWhen(booking.version !== input.version, () => bookingError("CONFLICT"));
        const reason = requirePresent(
          await tx.cancellationReason.findFirst({
            where: {
              code: input.reasonCode,
              actor: "PROVIDER",
              purpose: "REJECT",
              active: true,
            },
          }),
          () => bookingError("VALIDATION_FAILED", { reason: "UNKNOWN_REASON" }),
        );
        await this.requireRule(tx, "PROVIDER", "CONFIRMED", "CANCELLED");
        const cancellationId = await this.terminalCancel(tx, {
          bookingId: input.bookingId,
          expectedVersion: input.version,
          fromStatus: "CONFIRMED",
          actorKind: "PROVIDER",
          actorUserId: input.actorUserId,
          actorType: "PROVIDER",
          reasonId: reason.id,
          reasonCode: reason.code,
          responseStatus: "REJECTED",
          notifyTemplate: "BOOKING_REJECTED",
          recipientUserId: booking.customerUserId,
          locale: booking.locale,
        });
        return {
          bookingId: input.bookingId,
          status: "CANCELLED" as const,
          version: input.version + 1,
          responseStatus: "REJECTED" as const,
          cancellationId,
        };
      },
    });
  }

  public async providerCancel(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly bookingId: string;
    readonly version: number;
    readonly reasonCode: string;
    readonly idempotencyKey: string;
  }): Promise<{ readonly bookingId: string; readonly status: "CANCELLED"; readonly version: number; readonly cancellationId: string }> {
    await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "PROVIDER_CANCEL",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        version: input.version,
        providerId: input.providerId,
        reasonCode: input.reasonCode,
      },
      run: async (tx) => {
        await this.deps.assertActiveProviderManager(input.providerId, input.actorUserId);
        const booking = await this.requireProviderBooking(tx, input.bookingId, input.providerId);
        failWhen(booking.status === "CONFIRMED", () => bookingError("TRANSITION_NOT_AVAILABLE"));
        failWhen(booking.status !== "ACCEPTED", () => bookingError("TRANSITION_NOT_AVAILABLE"));
        failWhen(booking.version !== input.version, () => bookingError("CONFLICT"));
        const reason = requirePresent(
          await tx.cancellationReason.findFirst({
            where: {
              code: input.reasonCode,
              actor: "PROVIDER",
              purpose: "CANCEL",
              active: true,
            },
          }),
          () => bookingError("VALIDATION_FAILED", { reason: "UNKNOWN_REASON" }),
        );
        await this.requireRule(tx, "PROVIDER", "ACCEPTED", "CANCELLED");
        const cancellationId = await this.terminalCancel(tx, {
          bookingId: input.bookingId,
          expectedVersion: input.version,
          fromStatus: "ACCEPTED",
          actorKind: "PROVIDER",
          actorUserId: input.actorUserId,
          actorType: "PROVIDER",
          reasonId: reason.id,
          reasonCode: reason.code,
          notifyTemplate: "BOOKING_CANCELLED",
          recipientUserId: booking.customerUserId,
          locale: booking.locale,
        });
        return {
          bookingId: input.bookingId,
          status: "CANCELLED" as const,
          version: input.version + 1,
          cancellationId,
        };
      },
    });
  }

  public async staffCancel(input: {
    readonly actorUserId: string;
    readonly bookingId: string;
    readonly version: number;
    readonly reasonCode: string;
    readonly idempotencyKey: string;
  }): Promise<{ readonly bookingId: string; readonly status: "CANCELLED"; readonly version: number; readonly cancellationId: string }> {
    failWhen(!(await this.deps.isStaffAdmin(input.actorUserId)), () => bookingError("FORBIDDEN"));
    await this.expireThenDenyIfExpired(input.bookingId);
    return this.withActorIdempotency({
      actorUserId: input.actorUserId,
      commandType: "STAFF_CANCEL",
      idempotencyKey: input.idempotencyKey,
      bookingId: input.bookingId,
      request: {
        bookingId: input.bookingId,
        version: input.version,
        reasonCode: input.reasonCode,
      },
      run: async (tx) => {
        failWhen(!(await this.deps.isStaffAdmin(input.actorUserId)), () => bookingError("FORBIDDEN"));
        const booking = requirePresent(
          await tx.booking.findUnique({ where: { id: input.bookingId } }),
          () => bookingError("NOT_FOUND"),
        );
        failWhen(!canCancelAfterConfirm(booking.status), () => bookingError("TRANSITION_NOT_AVAILABLE"));
        failWhen(booking.version !== input.version, () => bookingError("CONFLICT"));
        const reason = requirePresent(
          await tx.cancellationReason.findFirst({
            where: {
              code: input.reasonCode,
              actor: "STAFF_ADMIN",
              purpose: "CANCEL",
              active: true,
            },
          }),
          () => bookingError("VALIDATION_FAILED", { reason: "UNKNOWN_REASON" }),
        );
        await this.requireRule(tx, "STAFF_ADMIN", booking.status, "CANCELLED");
        const recipient = notifyRecipient(
          await this.deps.resolveProviderOwnerUserId(booking.providerId),
          booking.customerUserId,
        );
        const cancellationId = await this.terminalCancel(tx, {
          bookingId: input.bookingId,
          expectedVersion: input.version,
          fromStatus: booking.status,
          actorKind: "STAFF_ADMIN",
          actorUserId: input.actorUserId,
          actorType: "STAFF_ADMIN",
          reasonId: reason.id,
          reasonCode: reason.code,
          notifyTemplate: "BOOKING_CANCELLED",
          recipientUserId: recipient,
          locale: booking.locale,
        });
        return {
          bookingId: input.bookingId,
          status: "CANCELLED" as const,
          version: input.version + 1,
          cancellationId,
        };
      },
    });
  }

  public async customerCancelConfirmed(input: {
    readonly customerUserId: string;
    readonly bookingId: string;
    readonly version: number;
    readonly reason: string;
    readonly command?: {
      readonly customerUserId: string;
      readonly commandType: "CANCEL";
      readonly idempotencyKey: string;
      readonly requestHash: string;
    };
    readonly responseJson?: Record<string, unknown>;
  }): Promise<{ readonly bookingId: string; readonly status: "CANCELLED" }> {
    const db = clientOf(this.deps);
    const owned = await db.booking.findFirst({
      where: { id: input.bookingId, customerUserId: input.customerUserId },
      select: { id: true },
    });
    failWhen(owned === null, () => bookingError("NOT_FOUND"));
    await this.expireThenDenyIfExpired(input.bookingId);
    return db.$transaction(async (tx) => {
      const booking = requirePresent(
        await tx.booking.findFirst({
          where: { id: input.bookingId, customerUserId: input.customerUserId },
        }),
        () => bookingError("NOT_FOUND"),
      );
      failWhen(!canCancelAfterConfirm(booking.status), () => bookingError("TRANSITION_NOT_AVAILABLE"));
      failWhen(booking.version !== input.version, () => bookingError("CONFLICT"));
      const reason = requirePresent(
        await tx.cancellationReason.findFirst({
          where: {
            code: customerCancelReasonCode(input.reason),
            actor: "CUSTOMER",
            purpose: "CANCEL",
            active: true,
          },
        }),
        () => bookingError("VALIDATION_FAILED", { reason: "UNKNOWN_REASON" }),
      );
      await this.requireRule(tx, "CUSTOMER", booking.status, "CANCELLED");
      const owner = requirePresent(
        await this.deps.resolveProviderOwnerUserId(booking.providerId),
        () => bookingError("DEPENDENCY_FAILURE", { reason: "PROVIDER_OWNER" }),
      );
      const commandRow = await this.reserveCustomerCommand(tx, input);
      await this.terminalCancel(tx, {
        bookingId: input.bookingId,
        expectedVersion: input.version,
        fromStatus: booking.status,
        actorKind: "CUSTOMER",
        actorUserId: input.customerUserId,
        actorType: "CUSTOMER",
        reasonId: reason.id,
        reasonCode: reason.code,
        notifyTemplate: "BOOKING_CANCELLED",
        recipientUserId: owner,
        locale: booking.locale,
      });
      if (commandRow !== null) {
        await tx.bookingCommand.update({
          where: { id: commandRow.id },
          data: {
            responseJson:
              input.responseJson ?? {
                id: input.bookingId,
                status: "CANCELLED",
                version: input.version + 1,
              },
          },
        });
      }
      return { bookingId: input.bookingId, status: "CANCELLED" as const };
    });
  }

  private async reserveCustomerCommand(
    tx: BookingTx,
    input: {
      readonly bookingId: string;
      readonly command?: {
        readonly customerUserId: string;
        readonly commandType: "CANCEL";
        readonly idempotencyKey: string;
        readonly requestHash: string;
      };
    },
  ): Promise<{ readonly id: string } | null> {
    if (input.command === undefined) {
      return null;
    }
    try {
      return (await tx.bookingCommand.create({
        data: {
          customerUserId: input.command.customerUserId,
          commandType: input.command.commandType,
          idempotencyKey: input.command.idempotencyKey,
          bookingId: input.bookingId,
          requestHash: input.command.requestHash,
          responseJson: { reserved: true },
        },
      })) as { id: string };
    } catch (error) {
      if (isUniqueCollision(error)) {
        throw new BookingIdempotencyCollision();
      }
      throw error;
    }
  }

  public async ensurePendingResponse(
    tx: BookingTx,
    input: {
      readonly bookingId: string;
      readonly providerId: string;
      readonly countryId: string;
      readonly customerUserId: string;
      readonly locale: "AR" | "EN";
    },
  ): Promise<void> {
    const hours = requirePresent(
      await this.deps.readResponseHours(input.countryId),
      () => bookingError("DEPENDENCY_FAILURE", { reason: "PROVIDER_RESPONSE_HOURS" }),
    );
    const existing = await tx.bookingResponse.findUnique({
      where: { bookingId: input.bookingId },
    });
    if (existing !== null) {
      return;
    } else {
    const ownerUserId = requirePresent(
      await this.deps.resolveProviderOwnerUserId(input.providerId),
      () => bookingError("DEPENDENCY_FAILURE", { reason: "PROVIDER_OWNER" }),
    );
    const expiresAt = new Date(this.deps.now().getTime() + hours * 60 * 60 * 1000);
    await tx.bookingResponse.create({
      data: {
        bookingId: input.bookingId,
        providerId: input.providerId,
        status: "PENDING",
        expiresAt,
      },
    });
    await this.insertIntent(tx, {
      bookingId: input.bookingId,
      template: "BOOKING_CONFIRMED_FOR_PROVIDER",
      recipientUserId: ownerUserId,
      locale: input.locale,
      idempotencyKey: shaIdempotency([
        "BOOKING_CONFIRMED_FOR_PROVIDER",
        input.bookingId,
      ]),
    });
    }
  }

  private async expireThenDenyIfExpired(bookingId: string): Promise<void> {
    const expiredNow = await this.expireIfPending(bookingId);
    failWhen(expiredNow, () => bookingError("RESPONSE_EXPIRED"));
  }

  private async expireIfPending(bookingId: string): Promise<boolean> {
    let expiredNow = false;
    const run = async (db: BookingTx) => {
      const response = await db.bookingResponse.findUnique({
        where: { bookingId },
        include: { booking: true },
      });
      if (!isPendingResponse(response)) {
        return;
      } else if (response.expiresAt.getTime() > this.deps.now().getTime()) {
        return;
      } else if (response.booking.status !== "CONFIRMED") {
        return;
      } else {
      const reason = requirePresent(
        await db.cancellationReason.findUnique({
          where: { code: "PROVIDER_RESPONSE_EXPIRED" },
        }),
        () => bookingError("DEPENDENCY_FAILURE", { reason: "EXPIRY_REASON" }),
      );
      await this.requireRule(db, "SYSTEM", "CONFIRMED", "CANCELLED");
      await this.terminalCancel(db, {
        bookingId,
        expectedVersion: response.booking.version,
        fromStatus: "CONFIRMED",
        actorKind: "SYSTEM",
        actorUserId: null,
        actorType: "SYSTEM",
        reasonId: reason.id,
        reasonCode: reason.code,
        responseStatus: "EXPIRED",
        notifyTemplate: "BOOKING_RESPONSE_EXPIRED",
        recipientUserId: response.booking.customerUserId,
        locale: response.booking.locale,
      });
      expiredNow = true;
      }
    };
    try {
      await clientOf(this.deps).$transaction((nested) => run(nested));
      return expiredNow;
    } catch (error) {
      if (isConflictError(error)) {
        return false;
      } else {
        throw error;
      }
    }
  }

  private async terminalCancel(
    tx: BookingTx,
    input: {
      readonly bookingId: string;
      readonly expectedVersion: number;
      readonly fromStatus: string;
      readonly actorKind: "CUSTOMER" | "PROVIDER" | "STAFF_ADMIN" | "SYSTEM";
      readonly actorUserId: string | null;
      readonly actorType: "CUSTOMER" | "PROVIDER" | "STAFF_ADMIN" | "SYSTEM";
      readonly reasonId: string;
      readonly reasonCode: string;
      readonly responseStatus?: "REJECTED" | "EXPIRED";
      readonly notifyTemplate: "BOOKING_REJECTED" | "BOOKING_RESPONSE_EXPIRED" | "BOOKING_CANCELLED";
      readonly recipientUserId: string;
      readonly locale: "AR" | "EN";
    },
  ): Promise<string> {
    const claimed = await tx.booking.updateMany({
      where: {
        id: input.bookingId,
        status: input.fromStatus as BookingStatusName,
        version: input.expectedVersion,
      },
      data: {
        status: "CANCELLED",
        version: { increment: 1 },
        cancelledAt: this.deps.now(),
      },
    });
    failWhen(claimed.count !== 1, () => bookingError("CONFLICT"));
    if (input.responseStatus !== undefined) {
      await tx.bookingResponse.updateMany({
        where: { bookingId: input.bookingId, status: "PENDING" },
        data: {
          status: input.responseStatus,
          decidedAt: this.deps.now(),
          decidedByUserId: input.actorUserId,
          ...(input.responseStatus === "REJECTED" ? { rejectReasonId: input.reasonId } : {}),
        },
      });
    } else {
      // Customer and provider-accepted cancels keep the response row unchanged.
    }
    const cancellation = await tx.bookingCancellation.create({
      data: {
        bookingId: input.bookingId,
        actorKind: input.actorKind,
        actorUserId: input.actorUserId,
        reasonId: input.reasonId,
        fromStatus: input.fromStatus,
      },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: input.bookingId,
        fromStatus: input.fromStatus,
        toStatus: "CANCELLED",
        actorUserId: input.actorUserId,
        actorType: input.actorType,
        reasonCode: input.reasonCode,
      },
    });
    await this.insertIntent(tx, {
      bookingId: input.bookingId,
      template: input.notifyTemplate,
      recipientUserId: input.recipientUserId,
      locale: input.locale,
      idempotencyKey: shaIdempotency([input.notifyTemplate, input.bookingId]),
    });
    return cancellation.id;
  }

  private async insertIntent(
    tx: BookingTx,
    input: {
      readonly bookingId: string;
      readonly template:
        | "BOOKING_CONFIRMED_FOR_PROVIDER"
        | "BOOKING_ACCEPTED"
        | "BOOKING_REJECTED"
        | "BOOKING_RESPONSE_EXPIRED"
        | "BOOKING_CANCELLED";
      readonly recipientUserId: string;
      readonly locale: "AR" | "EN";
      readonly idempotencyKey: string;
    },
  ): Promise<void> {
    await tx.bookingNotificationIntent.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        bookingId: input.bookingId,
        template: input.template,
        locale: input.locale,
        recipientUserId: input.recipientUserId,
        idempotencyKey: input.idempotencyKey,
        safeVariables: { bookingId: input.bookingId },
        status: "PENDING",
      },
      update: {},
    });
  }

  private async requireRule(
    tx: BookingTx,
    actor: "CUSTOMER" | "PROVIDER" | "SYSTEM" | "STAFF_ADMIN",
    fromStatus: string,
    toStatus: string,
  ): Promise<void> {
    const rule = await tx.statusTransitionRule.findFirst({
      where: { actor, fromStatus, toStatus, executable: true },
      select: { id: true },
    });
    failWhen(rule === null, () => bookingError("TRANSITION_NOT_AVAILABLE"));
  }

  private async requireProviderBooking(tx: BookingTx, bookingId: string, providerId: string) {
    const booking = requirePresent(
      await tx.booking.findUnique({ where: { id: bookingId } }),
      () => bookingError("NOT_FOUND"),
    );
    failWhen(booking.providerId !== providerId, () => bookingError("NOT_FOUND"));
    return booking;
  }

  private async loadDossier(bookingId: string): Promise<BookingDossier | null> {
    const db = clientOf(this.deps);
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        address: true,
        priceBreakdown: true,
        response: true,
        cancellation: { include: { reason: true } },
        items: true,
      },
    });
    if (booking === null) {
      return null;
    } else {
    return {
      bookingId: booking.id,
      status: booking.status,
      providerId: booking.providerId,
      customerUserId: booking.customerUserId,
      serviceId: booking.serviceId,
      service: frozenService(booking.items),
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      addressText: booking.address === null ? null : booking.address.addressText,
      crewPreference: booking.crewPreference,
      version: booking.version,
      quote: quoteProjection(booking.priceBreakdown),
      response: responseProjection(booking.response),
      cancellation: cancellationProjection(booking.cancellation),
    };
    }
  }

  private async withActorIdempotency<T>(input: {
    readonly actorUserId: string;
    readonly commandType: "ACCEPT" | "REJECT" | "PROVIDER_CANCEL" | "STAFF_CANCEL";
    readonly idempotencyKey: string;
    readonly bookingId: string;
    readonly request: unknown;
    readonly run: (tx: BookingTx) => Promise<T>;
  }): Promise<T> {
    const db = clientOf(this.deps);
    const requestHash = requestHashOf(input.request);
    const existing = await db.bookingActorCommand.findUnique({
      where: {
        actorUserId_commandType_idempotencyKey: {
          actorUserId: input.actorUserId,
          commandType: input.commandType,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing !== null) {
      failWhen(existing.requestHash !== requestHash, () => bookingError("IDEMPOTENCY_BODY_MISMATCH"));
      return existing.responseJson as T;
    } else {
    try {
      return await db.$transaction(async (tx) => {
        const created = await tx.bookingActorCommand.create({
          data: {
            actorUserId: input.actorUserId,
            commandType: input.commandType,
            idempotencyKey: input.idempotencyKey,
            bookingId: input.bookingId,
            requestHash,
            responseJson: {},
          },
        });
        const result = await input.run(tx);
        await tx.bookingActorCommand.update({
          where: { id: created.id },
          data: { responseJson: result },
        });
        return result;
      });
    } catch (error) {
      if (!isUniqueCollision(error)) {
        throw error;
      }
      const raced = await db.bookingActorCommand.findUnique({
        where: {
          actorUserId_commandType_idempotencyKey: {
            actorUserId: input.actorUserId,
            commandType: input.commandType,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      failWhen(raced === null, () => bookingError("CONFLICT"));
      failWhen(raced.requestHash !== requestHash, () => bookingError("IDEMPOTENCY_BODY_MISMATCH"));
      return raced.responseJson as T;
    }
    }
  }
}

export function createBookingResponseService(
  dependencies: BookingResponseServiceDependencies,
): BookingResponseService {
  return new BookingResponseService(dependencies);
}
