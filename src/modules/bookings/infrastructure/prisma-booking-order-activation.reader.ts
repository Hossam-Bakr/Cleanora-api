/**
 * Bookings-owned reader of ASSIGNED + ACTIVE assignment facts for Orders.
 */

export interface BookingOrderActivationMember {
  readonly workerId: string;
  readonly workerUserId: string | null;
}

export interface BookingOrderActivationFacts {
  readonly bookingId: string;
  readonly status: string;
  readonly providerId: string;
  readonly customerUserId: string;
  readonly activeAssignment: {
    readonly assignmentId: string;
    readonly members: readonly BookingOrderActivationMember[];
  } | null;
}

export interface BookingOrderActivationReader {
  readByBookingId(
    bookingId: string,
  ): Promise<BookingOrderActivationFacts | null>;
}

type StoreDelegate = {
  findUnique: (args: unknown) => Promise<any>;
  findFirst: (args: unknown) => Promise<any>;
};

/**
 * @desc Read booking status + ACTIVE assignment members for order activation.
 * @access Bookings infrastructure (consumed by Orders via public port)
 */
export function createPrismaBookingOrderActivationReader(
  client: unknown,
): BookingOrderActivationReader {
  const db = client as {
    booking: StoreDelegate;
    bookingAssignment: StoreDelegate;
  };
  return {
    async readByBookingId(bookingId) {
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          providerId: true,
          customerUserId: true,
        },
      });
      if (booking === null) {
        return null;
      }
      const assignment = await db.bookingAssignment.findFirst({
        where: { bookingId, status: "ACTIVE" },
        include: {
          members: {
            select: {
              workerId: true,
              workerUserId: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return {
        bookingId: booking.id,
        status: booking.status,
        providerId: booking.providerId,
        customerUserId: booking.customerUserId,
        activeAssignment:
          assignment === null
            ? null
            : {
                assignmentId: assignment.id,
                members: assignment.members.map(
                  (member: {
                    workerId: string;
                    workerUserId: string | null;
                  }) => ({
                    workerId: member.workerId,
                    workerUserId: member.workerUserId,
                  }),
                ),
              },
      };
    },
  };
}
