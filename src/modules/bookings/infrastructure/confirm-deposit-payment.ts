import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";
import { bookingError } from "../bookings.errors.js";
import type {
  ConfirmDepositPayment,
  ConfirmDepositPaymentInput,
} from "../bookings.public.js";

export interface ConfirmDepositPaymentExtras {
  readonly onConfirmed: (input: {
    readonly tx: unknown;
    readonly bookingId: string;
    readonly providerId: string;
    readonly countryId: string;
    readonly customerUserId: string;
    readonly locale: "AR" | "EN";
  }) => Promise<void>;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function hasBlankConfirmFields(input: ConfirmDepositPaymentInput): boolean {
  return [
    input.bookingId,
    input.paymentId,
    input.expectedDepositMinorUnits,
    input.currencyCode,
    input.reason,
  ].some((field) => isBlank(field));
}

function isAllowedConfirmActor(actorKind: string): boolean {
  return actorKind === "SYSTEM" || actorKind === "TEST";
}

function depositText(
  value: { toFixed(digits: number): string } | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  } else {
    return value.toFixed(0);
  }
}

function depositMatchesExpected(stored: string | null, expected: string): boolean {
  if (stored === null) {
    return false;
  } else {
    return stored === expected;
  }
}

function isConfirmedStatus(status: string | undefined): boolean {
  return status === "CONFIRMED";
}

async function invokeOnConfirmed(
  extras: ConfirmDepositPaymentExtras | undefined,
  tx: unknown,
  booking: {
    readonly id: string;
    readonly providerId: string;
    readonly countryId: string;
    readonly customerUserId: string;
    readonly locale: "AR" | "EN";
  },
): Promise<void> {
  if (extras === undefined) {
    return;
  } else {
    await extras.onConfirmed({
      tx,
      bookingId: booking.id,
      providerId: booking.providerId,
      countryId: booking.countryId,
      customerUserId: booking.customerUserId,
      locale: booking.locale,
    });
  }
}

/**
 * @desc SYSTEM seam: AWAITING_DEPOSIT → CONFIRMED after verified deposit success.
 * @access Bookings public / composition
 */
export function createConfirmDepositPayment(
  suppliedClient?: unknown,
  extras?: ConfirmDepositPaymentExtras,
): ConfirmDepositPayment {
  const client = (suppliedClient ?? getPrismaClient()) as PrismaClient;

  return async (input: ConfirmDepositPaymentInput) => {
    if (hasBlankConfirmFields(input)) {
      throw bookingError("VALIDATION_FAILED");
    }
    if (!isAllowedConfirmActor(input.actorKind)) {
      throw bookingError("FORBIDDEN");
    }

    return client.$transaction(async (tx) => {
      const rule = await tx.statusTransitionRule.findFirst({
        where: {
          actor: "SYSTEM",
          fromStatus: "AWAITING_DEPOSIT",
          toStatus: "CONFIRMED",
          executable: true,
        },
        select: { id: true },
      });
      if (rule === null) {
        throw bookingError("TRANSITION_NOT_AVAILABLE");
      }

      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: {
          id: true,
          status: true,
          currencyCode: true,
          depositMinorUnits: true,
          version: true,
          providerId: true,
          countryId: true,
          customerUserId: true,
          locale: true,
        },
      });
      if (booking === null) {
        throw bookingError("NOT_FOUND");
      }
      if (booking.status === "ACCEPTED") {
        return { bookingId: booking.id, status: "CONFIRMED" as const };
      }
      if (isConfirmedStatus(booking.status)) {
        await invokeOnConfirmed(extras, tx, booking);
        return { bookingId: booking.id, status: "CONFIRMED" as const };
      }
      if (booking.status !== "AWAITING_DEPOSIT") {
        throw bookingError("TRANSITION_NOT_AVAILABLE");
      }
      if (booking.currencyCode !== input.currencyCode) {
        throw bookingError("VALIDATION_FAILED", { reason: "CURRENCY" });
      }
      if (!depositMatchesExpected(depositText(booking.depositMinorUnits), input.expectedDepositMinorUnits)) {
        throw bookingError("VALIDATION_FAILED", { reason: "AMOUNT_MISMATCH" });
      }

      const claimed = await tx.booking.updateMany({
        where: {
          id: input.bookingId,
          status: "AWAITING_DEPOSIT",
          version: booking.version,
        },
        data: {
          status: "CONFIRMED",
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        const again = await tx.booking.findUnique({
          where: { id: input.bookingId },
          select: { status: true },
        });
        if (isConfirmedStatus(again?.status)) {
          return { bookingId: input.bookingId, status: "CONFIRMED" as const };
        }
        throw bookingError("CONFLICT");
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.bookingId,
          fromStatus: "AWAITING_DEPOSIT",
          toStatus: "CONFIRMED",
          actorType: "SYSTEM",
          reasonCode: "DEPOSIT_VERIFIED",
          requestId: input.paymentId,
        },
      });

      await invokeOnConfirmed(extras, tx, booking);

      return { bookingId: input.bookingId, status: "CONFIRMED" as const };
    });
  };
}

export type { Prisma };
