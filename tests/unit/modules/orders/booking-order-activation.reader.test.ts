import { createPrismaBookingOrderActivationReader } from "#modules/bookings/infrastructure/prisma-booking-order-activation.reader";

describe("R1-P18 booking order activation reader", () => {
  it("returns ASSIGNED booking with ACTIVE assignment members", async () => {
    const client = {
      booking: {
        findUnique: async () => ({
          id: "bk-1",
          status: "ASSIGNED",
          providerId: "prov-1",
          customerUserId: "cust-1",
        }),
      },
      bookingAssignment: {
        findFirst: async () => ({
          id: "asg-1",
          members: [{ workerId: "w-1", workerUserId: "u-1" }],
        }),
      },
    };
    const reader = createPrismaBookingOrderActivationReader(client);
    await expect(reader.readByBookingId("bk-1")).resolves.toEqual({
      bookingId: "bk-1",
      status: "ASSIGNED",
      providerId: "prov-1",
      customerUserId: "cust-1",
      activeAssignment: {
        assignmentId: "asg-1",
        members: [{ workerId: "w-1", workerUserId: "u-1" }],
      },
    });
  });

  it("returns null when booking is missing and null assignment when none active", async () => {
    const missing = createPrismaBookingOrderActivationReader({
      booking: { findUnique: async () => null },
      bookingAssignment: { findFirst: async () => null },
    });
    await expect(missing.readByBookingId("missing")).resolves.toBeNull();

    const noAssignment = createPrismaBookingOrderActivationReader({
      booking: {
        findUnique: async () => ({
          id: "bk-2",
          status: "ASSIGNED",
          providerId: "p",
          customerUserId: "c",
        }),
      },
      bookingAssignment: { findFirst: async () => null },
    });
    await expect(noAssignment.readByBookingId("bk-2")).resolves.toMatchObject({
      activeAssignment: null,
    });
  });
});
