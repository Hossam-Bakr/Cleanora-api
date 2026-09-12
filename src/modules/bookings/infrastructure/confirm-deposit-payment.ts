import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";
import { bookingError } from "../bookings.errors.js";
import type {
  ConfirmDepositPayment,
  ConfirmDepositPaymentInput,
} from "../bookings.public.js";

/**
 * @desc SYSTEM seam: AWAITING_DEPOSIT → CONFIRMED after verified deposit success.
 * @access Bookings public / composition
 */
export function createConfirmDepositPayment(
  suppliedClient?: unknown,
): ConfirmDepositPayment {
  const client = (suppliedClient ?? getPrismaClient()) as PrismaClient;

  return async (input: ConfirmDepositPaymentInput) => {
    if (
      input.bookingId.trim().length === 0 ||
      input.paymentId.trim().length === 0 ||
      input.expectedDepositMinorUnits.trim().length === 0 ||
      input.currencyCode.trim().length === 0 ||
      input.reason.trim().length === 0
    ) {
      throw bookingError("VALIDATION_FAILED");
    }
    if (input.actorKind !== "SYSTEM" && input.actorKind !== "TEST") {
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
        },
      });
      if (booking === null) {
        throw bookingError("NOT_FOUND");
      }
      if (booking.status === "CONFIRMED") {
        // Idempotent replay after durable confirm.
        return { bookingId: booking.id, status: "CONFIRMED" as const };
      }
      if (booking.status !== "AWAITING_DEPOSIT") {
        throw bookingError("TRANSITION_NOT_AVAILABLE");
      }
      if (booking.currencyCode !== input.currencyCode) {
        throw bookingError("VALIDATION_FAILED", { reason: "CURRENCY" });
      }
      const deposit = booking.depositMinorUnits?.toFixed(0) ?? null;
      if (
        deposit === null ||
        deposit !== input.expectedDepositMinorUnits
      ) {
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
        if (again?.status === "CONFIRMED") {
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

      return { bookingId: input.bookingId, status: "CONFIRMED" as const };
    });
  };
}

export type { Prisma };
