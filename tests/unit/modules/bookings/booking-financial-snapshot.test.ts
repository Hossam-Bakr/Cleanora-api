import { createPrismaBookingFinancialSnapshotReader } from "#modules/bookings/infrastructure/prisma-booking-financial-snapshot.reader";

describe("R1-P14 booking financial snapshot reader", () => {
  it("maps persisted minor units and returns null for a missing booking", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: "booking-1",
        status: "AWAITING_DEPOSIT",
        countryId: "country-eg",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        providerId: "provider-1",
        grossMinorUnits: { toFixed: () => "10000" },
        depositMinorUnits: { toFixed: () => "2500" },
        remainderMinorUnits: { toFixed: () => "7500" },
      })
      .mockResolvedValueOnce(null);
    const reader = createPrismaBookingFinancialSnapshotReader({
      booking: { findUnique },
    });
    await expect(reader.readById({ bookingId: "booking-1" })).resolves.toEqual({
      bookingId: "booking-1",
      status: "AWAITING_DEPOSIT",
      countryId: "country-eg",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      providerId: "provider-1",
      grossMinorUnits: "10000",
      depositMinorUnits: "2500",
      remainderMinorUnits: "7500",
    });
    await expect(reader.readById({ bookingId: "missing" })).resolves.toBeNull();
  });
});
