import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { BookingsCommandService } from "#modules/bookings/bookings.command.service";
import type { BookingAggregate } from "#modules/bookings/bookings.command.types";
import {
  hashBookingRequest,
  type BookingsCommandRepository,
} from "#modules/bookings/bookings.command.types";

function customerPrincipal(): AuthenticationPrincipal {
  return {
    userId: "user-1",
    sessionId: "session-1",
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
  };
}

function confirmedBooking(): BookingAggregate {
  return {
    id: "booking-1",
    customerUserId: "user-1",
    countryId: "country-1",
    currencyCode: "EGP",
    currencyDecimalPlaces: 2,
    status: "CONFIRMED",
    serviceId: "service-1",
    providerId: "provider-1",
    teamId: "team-1",
    cityId: "city-1",
    districtId: "district-1",
    startsAt: "2026-09-10T08:00:00.000Z",
    endsAt: "2026-09-10T12:00:00.000Z",
    crewPreference: "any",
    requiredTeamUnits: 1,
    locale: "AR",
    notes: null,
    emergencySignaled: false,
    version: 4,
    depositPercent: "25.00",
    quote: null,
    eligibilityEvaluationId: "eval-1",
    item: null,
    address: null,
    answers: [],
    media: [],
    snapshot: null,
    priceBreakdown: null,
    snapshotFrozen: true,
    statusHistory: [],
    createdAt: "2026-09-10T07:00:00.000Z",
    submittedAt: "2026-09-10T07:30:00.000Z",
    cancelledAt: null,
  };
}

function unusedRepo(): BookingsCommandRepository {
  return {
    isExecutableTransition: vi.fn(),
    findCommand: vi.fn().mockResolvedValue(null),
    createDraft: vi.fn(),
    findOwned: vi.fn(),
    listOwned: vi.fn(),
    replaceDraftContents: vi.fn(),
    attachMedia: vi.fn(),
    submitForDeposit: vi.fn(),
    cancel: vi.fn(),
    recordCompletedCommand: vi.fn(),
  };
}

function unusedPorts() {
  return {
    eligibility: { evaluateEligibility: vi.fn() },
    catalog: { getSnapshotReadyDefinitionById: vi.fn() },
    locality: {
      listActiveCitiesForCountry: vi.fn(),
      listActiveDistrictsForCity: vi.fn(),
    },
    depositPercent: { readForCountryId: vi.fn() },
    addresses: { readOwnedAddress: vi.fn() },
    attachments: {
      readOwnedReadyImage: vi.fn(),
      signOwnedReadyImage: vi.fn().mockResolvedValue(null),
    },
    serviceSnapshots: { getSnapshotReadyFacts: vi.fn() },
    activeCountries: { getActiveCountryById: vi.fn() },
  };
}

describe("R1-P16 customer command hooks", () => {
  it("puts response and cancellation on the customer booking get payload", async () => {
    const booking = confirmedBooking();
    const repository = unusedRepo();
    repository.findOwned = vi.fn().mockResolvedValue(booking);
    const service = new BookingsCommandService({
      repository,
      ...unusedPorts(),
      readDossier: async () => ({
        response: { status: "PENDING", expiresAt: "2026-09-14T12:00:00.000Z", decidedAt: null },
        cancellation: null,
      }),
    });
    const presented = (await service.get(customerPrincipal(), "booking-1")) as {
      id: string;
      response: { status: string } | null;
      cancellation: unknown;
      dossier?: unknown;
    };
    expect(presented.id).toBe("booking-1");
    expect(presented.response).toEqual({
      status: "PENDING",
      expiresAt: "2026-09-14T12:00:00.000Z",
      decidedAt: null,
    });
    expect(presented.cancellation).toBeNull();
    expect(presented.dossier).toBeUndefined();
  });

  it("cancels a confirmed booking through the P16 hook without a fee field", async () => {
    const booking = confirmedBooking();
    const cancelled = { ...booking, status: "CANCELLED" as const, version: 5 };
    const repository = unusedRepo();
    repository.findOwned = vi
      .fn()
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce(cancelled);
    const cancelConfirmed = vi.fn().mockResolvedValue({
      bookingId: "booking-1",
      status: "CANCELLED",
    });
    const service = new BookingsCommandService({
      repository,
      ...unusedPorts(),
      cancelConfirmed,
    });
    const result = (await service.cancel(
      customerPrincipal(),
      "booking-1",
      { version: 4, reason: "CUSTOMER_CHANGED_MIND" },
      "idem-cust",
    )) as { status: string };
    expect(cancelConfirmed).toHaveBeenCalledWith({
      customerUserId: "user-1",
      bookingId: "booking-1",
      version: 4,
      reason: "CUSTOMER_CHANGED_MIND",
      command: expect.objectContaining({
        commandType: "CANCEL",
        idempotencyKey: "idem-cust",
      }),
      responseJson: expect.objectContaining({
        id: "booking-1",
        status: "CANCELLED",
      }),
    });
    expect(result.status).toBe("CANCELLED");
    expect(JSON.stringify(result)).not.toMatch(/fee/i);
    expect(repository.cancel).not.toHaveBeenCalled();
    expect(repository.recordCompletedCommand).not.toHaveBeenCalled();
  });

  it("replays a confirmed customer cancel with the same idempotency key", async () => {
    const booking = confirmedBooking();
    const cancelled = { ...booking, status: "CANCELLED" as const, version: 5 };
    const body = { version: 4, reason: "CUSTOMER_CHANGED_MIND" as const };
    const repository = unusedRepo();
    repository.findCommand = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue({
        requestHash: hashBookingRequest({ bookingId: "booking-1", ...body }),
        bookingId: "booking-1",
        responseJson: { id: "booking-1", status: "CANCELLED" },
      });
    repository.findOwned = vi
      .fn()
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce(cancelled);
    const cancelConfirmed = vi.fn().mockResolvedValue({
      bookingId: "booking-1",
      status: "CANCELLED",
    });
    const service = new BookingsCommandService({
      repository,
      ...unusedPorts(),
      cancelConfirmed,
    });
    await service.cancel(customerPrincipal(), "booking-1", body, "idem-cust");
    const replay = (await service.cancel(
      customerPrincipal(),
      "booking-1",
      body,
      "idem-cust",
    )) as { status: string; id: string };
    expect(cancelConfirmed).toHaveBeenCalledTimes(1);
    expect(replay.id).toBe("booking-1");
    expect(replay.status).toBe("CANCELLED");
  });
});
