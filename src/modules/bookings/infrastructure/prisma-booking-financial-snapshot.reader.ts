import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";

import type {
  BookingFinancialSnapshot,
  BookingFinancialSnapshotReader,
} from "../bookings.public.js";

/**
 * @desc Booking commercial amounts for Payments reconciliation.
 * @access Bookings infrastructure
 */
export function createPrismaBookingFinancialSnapshotReader(
  suppliedClient?: unknown,
): BookingFinancialSnapshotReader {
  const client = (suppliedClient ?? getPrismaClient()) as
    | PrismaClient
    | Prisma.TransactionClient;
  return {
    async readById(input: {
      readonly bookingId: string;
    }): Promise<BookingFinancialSnapshot | null> {
      const row = await client.booking.findUnique({
        where: { id: input.bookingId },
        select: {
          id: true,
          customerUserId: true,
          status: true,
          countryId: true,
          currencyCode: true,
          currencyDecimalPlaces: true,
          providerId: true,
          grossMinorUnits: true,
          depositMinorUnits: true,
          remainderMinorUnits: true,
        },
      });
      if (row === null) {
        return null;
      }
      return {
        bookingId: row.id,
        customerUserId: row.customerUserId,
        status: row.status,
        countryId: row.countryId,
        currencyCode: row.currencyCode,
        currencyDecimalPlaces: row.currencyDecimalPlaces,
        providerId: row.providerId,
        grossMinorUnits: row.grossMinorUnits?.toFixed(0) ?? null,
        depositMinorUnits: row.depositMinorUnits?.toFixed(0) ?? null,
        remainderMinorUnits: row.remainderMinorUnits?.toFixed(0) ?? null,
      };
    },
  };
}
