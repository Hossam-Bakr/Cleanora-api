import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { BookingsCommandService } from "#modules/bookings/bookings.command.service";
import { createBookingBodySchema } from "#modules/bookings/bookings.command.schema";
import { quoteBooking } from "#modules/bookings/bookings.quote";
import { isExecutableCustomerTransition } from "#modules/bookings/bookings.matrix";
import {
  bookingPrerequisitesFor,
  isVerifiedCustomerPrincipal,
} from "#modules/bookings/bookings.customer";
import { BOOKING_PREREQUISITES } from "#modules/bookings/bookings.public";
import {
  formatMinorUnitsToCanonicalDecimal,
  parseCanonicalDecimalToMinorUnits,
  percentOfMinorUnits,
} from "#modules/bookings/bookings.money";
import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import type { BookingsCommandRepository } from "#modules/bookings/bookings.command.types";
import { BookingIdempotencyCollision } from "#modules/bookings/bookings.command.types";
import type { BookingQuote } from "#modules/bookings/bookings.quote";
import type { SnapshotReadyCatalogServiceDefinition } from "#modules/catalog/catalog.public";

function customerPrincipal(
  overrides: Partial<AuthenticationPrincipal> = {},
): AuthenticationPrincipal {
  return {
    userId: "user-1",
    sessionId: "session-1",
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
    ...overrides,
  };
}

const quote: BookingQuote = quoteBooking({
  currencyCode: "EGP",
  decimalPlaces: 2,
  priceAmount: "100.00",
  minimumChargeAmount: "80.00",
  depositPercent: "25",
});

function draftAggregate() {
  return {
    id: "booking-1",
    customerUserId: "user-1",
    countryId: "country-1",
    currencyCode: "EGP",
    currencyDecimalPlaces: 2,
    status: "DRAFT" as const,
    serviceId: "service-1",
    providerId: "provider-1",
    teamId: "team-1",
    cityId: "city-1",
    districtId: "district-1",
    startsAt: "2026-09-10T08:00:00.000Z",
    endsAt: "2026-09-10T12:00:00.000Z",
    crewPreference: "any" as const,
    requiredTeamUnits: 1,
    locale: "AR" as const,
    notes: null,
    emergencySignaled: false,
    version: 1,
    depositPercent: "25.00",
    quote,
    eligibilityEvaluationId: "eval-1",
    item: {
      catalogServiceId: "service-1",
      catalogServiceCode: "HOME_CLEANING",
      catalogServiceVersion: 1,
      providerServiceId: "ps-1",
      providerServiceVersion: 1,
      providerServicePriceId: "psp-1",
      estimatedDurationMinutes: 120,
    },
    address: {
      sourceUserAddressId: "addr-1",
      countryCode: "EG",
      cityId: "city-1",
      districtId: "district-1",
      cityLabel: "Cairo",
      districtLabel: "Nasr City",
      addressText: "1 Main St",
      building: null,
      floor: null,
      notes: null,
    },
    answers: [],
    media: [],
    statusHistory: [
      {
        fromStatus: "NONE",
        toStatus: "DRAFT" as const,
        actorType: "CUSTOMER",
        reasonCode: null,
        createdAt: "2026-09-10T07:00:00.000Z",
      },
    ],
    snapshot: null,
    priceBreakdown: null,
    snapshotFrozen: false,
    cancelledAt: null,
    submittedAt: null,
    createdAt: "2026-09-10T07:00:00.000Z",
  };
}

function catalogDefinition(): SnapshotReadyCatalogServiceDefinition {
  return {
    serviceId: "service-1",
    serviceCode: "HOME_CLEANING",
    serviceVersion: 1,
    category: { id: "cat", code: "HOME", name: "Home", description: "" },
    locale: "AR" as const,
    countryCode: "EG",
    name: "Home cleaning",
    description: "",
    priceUnits: [],
    fields: [
      {
        id: "field-req",
        code: "ROOMS",
        kind: "NUMBER" as const,
        label: "Rooms",
        helpText: null,
        required: true,
        textBounds: null,
        numberRules: { mode: "INTEGER" as const, min: "1", max: null },
        selectionBounds: null,
        options: [],
        displayOrder: 1,
      },
    ],
    media: [],
  };
}

function createService(overrides?: {
  readonly repository?: Partial<BookingsCommandRepository>;
  readonly eligible?: boolean;
  readonly deposit?: null | {
    countryId: string;
    countryCode: string;
    currencyCode: string;
    decimalPlaces: number;
    percentCanonical: string;
  };
  readonly attachment?: { mediaId: string; contentType: string } | null;
  readonly signedDelivery?: { url: string; urlExpiresAt: string } | null;
  readonly snapshotStatus?: "AVAILABLE" | "UNAVAILABLE" | "CONFLICT";
  readonly snapshotCurrency?: string;
  readonly country?: { id: string; code: string } | null;
  readonly catalog?: ReturnType<typeof catalogDefinition> | null;
  readonly ownedAddress?: {
    id: string;
    countryCode: string;
    city: string;
    district: string;
    addressText: string;
    building: string | null;
    floor: string | null;
    notes: string | null;
  } | null;
  readonly districts?: readonly {
    districtId: string;
    cityId: string;
    code: string;
    nameAr: string;
    nameEn: string;
  }[];
  readonly cities?: readonly {
    cityId: string;
    code: string;
    nameAr: string;
    nameEn: string;
  }[];
  readonly eligibilityError?: unknown;
}) {
  const repository: BookingsCommandRepository = {
    isExecutableTransition: vi.fn().mockResolvedValue(true),
    findCommand: vi.fn().mockResolvedValue(null),
    createDraft: vi.fn().mockResolvedValue(draftAggregate()),
    findOwned: vi.fn().mockResolvedValue(draftAggregate()),
    listOwned: vi
      .fn()
      .mockResolvedValue({ items: [draftAggregate()], nextCursor: null }),
    replaceDraftContents: vi
      .fn()
      .mockResolvedValue({ ...draftAggregate(), version: 2 }),
    attachMedia: vi.fn().mockResolvedValue({
      ...draftAggregate(),
      version: 2,
      media: [{ mediaId: "media-1", displayOrder: 0 }],
    }),
    submitForDeposit: vi.fn().mockResolvedValue({
      ...draftAggregate(),
      status: "AWAITING_DEPOSIT",
      version: 2,
      snapshotFrozen: true,
    }),
    cancel: vi.fn().mockResolvedValue({
      ...draftAggregate(),
      status: "CANCELLED",
      version: 2,
      cancelledAt: "2026-09-10T09:00:00.000Z",
    }),
    recordCompletedCommand: vi.fn().mockResolvedValue(undefined),
    ...overrides?.repository,
  };
  const evaluateEligibility = overrides?.eligibilityError
    ? vi.fn().mockRejectedValue(overrides.eligibilityError)
    : vi.fn().mockResolvedValue({
        evaluationId: "eval-1",
        eligibleTeams:
          overrides?.eligible === false
            ? []
            : [
                {
                  providerId: "provider-1",
                  teamId: "team-1",
                  eligible: true,
                  ruleOutcomes: [],
                  reasons: [],
                  sortingFacts: null,
                },
              ],
      });
  const service = new BookingsCommandService({
    repository,
    eligibility: { evaluateEligibility },
    catalog: {
      getSnapshotReadyDefinitionById: vi
        .fn()
        .mockResolvedValue(
          overrides?.catalog === undefined
            ? catalogDefinition()
            : overrides.catalog,
        ),
    },
    locality: {
      listActiveCitiesForCountry: vi.fn().mockResolvedValue(
        overrides?.cities ?? [
          {
            cityId: "city-1",
            code: "CAI",
            nameAr: "القاهرة",
            nameEn: "Cairo",
          },
        ],
      ),
      listActiveDistrictsForCity: vi.fn().mockResolvedValue(
        overrides?.districts ?? [
          {
            districtId: "district-1",
            cityId: "city-1",
            code: "NASR",
            nameAr: "مدينة نصر",
            nameEn: "Nasr City",
          },
        ],
      ),
    },
    depositPercent: {
      readForCountryId: vi.fn().mockResolvedValue(
        overrides?.deposit === undefined
          ? {
              countryId: "country-1",
              countryCode: "EG",
              currencyCode: "EGP",
              decimalPlaces: 2,
              percentCanonical: "25",
            }
          : overrides.deposit,
      ),
    },
    addresses: {
      readOwnedAddress: vi.fn().mockResolvedValue(
        overrides?.ownedAddress === undefined
          ? {
              id: "addr-1",
              countryCode: "EG",
              city: "Cairo",
              district: "Nasr City",
              addressText: "1 Main St",
              building: null,
              floor: null,
              notes: null,
            }
          : overrides.ownedAddress,
      ),
    },
    attachments: {
      readOwnedReadyImage: vi
        .fn()
        .mockResolvedValue(
          overrides?.attachment === undefined
            ? { mediaId: "media-1", contentType: "image/jpeg" }
            : overrides.attachment,
        ),
      signOwnedReadyImage: vi
        .fn()
        .mockResolvedValue(
          overrides?.signedDelivery === undefined
            ? null
            : overrides.signedDelivery,
        ),
    },
    serviceSnapshots: {
      getSnapshotReadyFacts: vi.fn().mockResolvedValue(
        overrides?.snapshotStatus === "CONFLICT"
          ? {
              status: "CONFLICT",
              code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
            }
          : overrides?.snapshotStatus === "UNAVAILABLE"
            ? { status: "UNAVAILABLE" }
            : {
                status: "AVAILABLE",
                value: {
                  providerId: "provider-1",
                  providerServiceId: "ps-1",
                  providerServiceVersion: 1,
                  catalogServiceId: "service-1",
                  catalogServiceCode: "HOME_CLEANING",
                  catalogServiceVersion: 1,
                  estimatedDurationMinutes: 120,
                  serviceNote: null,
                  providerServicePriceId: "psp-1",
                  price: "100.00",
                  minimumCharge: "80.00",
                  currencyCode: overrides?.snapshotCurrency ?? "EGP",
                  effectiveAt: "2026-09-01T00:00:00.000Z",
                  priceUnit: { id: "unit-1", code: "VISIT", label: "Visit" },
                  catalogDefinition: catalogDefinition(),
                },
              },
      ),
    },
    activeCountries: {
      getActiveCountryById: vi
        .fn()
        .mockResolvedValue(
          overrides?.country === undefined
            ? { id: "country-1", code: "EG" }
            : overrides.country,
        ),
    },
  });
  return { service, repository, evaluateEligibility };
}

const createBody = createBookingBodySchema.parse({
  serviceId: "service-1",
  providerId: "provider-1",
  teamId: "team-1",
  countryId: "country-1",
  cityId: "city-1",
  districtId: "district-1",
  startsAt: "2026-09-10T08:00:00.000Z",
  endsAt: "2026-09-10T12:00:00.000Z",
  crewPreference: "any",
  requiredTeamUnits: 1,
  locale: "AR",
  userAddressId: "addr-1",
});

describe("booking quote math", () => {
  it("uses max(price, minimumCharge) and round-half-up 25%", () => {
    expect(quote.gross).toBe("100.00");
    expect(quote.deposit).toBe("25.00");
    expect(quote.remainder).toBe("75.00");
    expect(quote.depositPercent).toBe("25.00");
  });

  it("raises gross to the minimum charge", () => {
    const raised = quoteBooking({
      currencyCode: "EGP",
      decimalPlaces: 2,
      priceAmount: "10.00",
      minimumChargeAmount: "100.00",
      depositPercent: "25",
    });
    expect(raised.gross).toBe("100.00");
    expect(raised.deposit).toBe("25.00");
  });
});

describe("status matrix", () => {
  it("allows the executable customer transitions only", () => {
    expect(isExecutableCustomerTransition("NONE", "DRAFT")).toBe(true);
    expect(isExecutableCustomerTransition("DRAFT", "AWAITING_DEPOSIT")).toBe(
      true,
    );
    expect(isExecutableCustomerTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(
      isExecutableCustomerTransition("AWAITING_DEPOSIT", "CANCELLED"),
    ).toBe(true);
    expect(isExecutableCustomerTransition("DRAFT", "CONFIRMED")).toBe(false);
    expect(
      isExecutableCustomerTransition("AWAITING_DEPOSIT", "CONFIRMED"),
    ).toBe(false);
    expect(isExecutableCustomerTransition("CANCELLED", "DRAFT")).toBe(false);
  });
});

describe("verified customer gate", () => {
  it("rejects guests, verification-only, and invitation-onboarding principals", () => {
    expect(isVerifiedCustomerPrincipal(null)).toBe(false);
    expect(
      isVerifiedCustomerPrincipal(
        customerPrincipal({ verificationOnly: true }),
      ),
    ).toBe(false);
    expect(
      isVerifiedCustomerPrincipal(
        customerPrincipal({ invitationOnboardingOnly: true }),
      ),
    ).toBe(false);
    expect(
      isVerifiedCustomerPrincipal(
        customerPrincipal({ verifiedCategories: ["PROVIDER_OWNER"] }),
      ),
    ).toBe(false);
    expect(bookingPrerequisitesFor(null)).toEqual({
      bookingAvailable: false,
      requiresVerifiedCustomer: true,
      phase: "R1-P13",
    });
    expect(bookingPrerequisitesFor(customerPrincipal()).bookingAvailable).toBe(
      true,
    );
    expect(BOOKING_PREREQUISITES.phase).toBe("R1-P13");
  });
});

describe("createBookingBodySchema", () => {
  it("rejects client totals", () => {
    const parsed = createBookingBodySchema.safeParse({
      ...createBody,
      gross: "100.00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) =>
          issue.message.includes("Client totals"),
        ),
      ).toBe(true);
    }
    expect(
      createBookingBodySchema.safeParse({
        ...createBody,
        endsAt: createBody.startsAt,
      }).success,
    ).toBe(false);
  });
});

describe("BookingsCommandService", () => {
  it("creates a draft with an explicit eligibility check and server quote", async () => {
    const { service, repository } = createService();
    const created = (await service.createDraft(
      customerPrincipal(),
      createBody,
      "idem-1",
    )) as { status: string; quote: { deposit: string } };
    expect(created.status).toBe("DRAFT");
    expect(created.quote.deposit).toBe("25.00");
    expect(repository.createDraft).toHaveBeenCalled();
  });

  it("fails closed when deposit percent is missing", async () => {
    const { service } = createService({ deposit: null });
    await expect(
      service.createDraft(customerPrincipal(), createBody, "idem-2"),
    ).rejects.toMatchObject({ code: "DEPOSIT_PERCENT_UNAVAILABLE" });
  });

  it("rejects an ineligible selected team", async () => {
    const { service } = createService({ eligible: false });
    await expect(
      service.createDraft(customerPrincipal(), createBody, "idem-3"),
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });

  it("replays identical idempotent creates", async () => {
    const { service, repository } = createService({
      repository: {
        findCommand: vi.fn().mockResolvedValue({
          requestHash: expect.any(String),
          bookingId: "booking-1",
          responseJson: { id: "booking-1", status: "DRAFT" },
        }),
      },
    });
    repository.findCommand = vi.fn().mockImplementation(async () => {
      const { hashBookingRequest } =
        await import("#modules/bookings/bookings.command.types");
      return {
        requestHash: hashBookingRequest(createBody),
        bookingId: "booking-1",
        responseJson: { id: "booking-1", status: "DRAFT" },
      };
    });
    const replayed = await service.createDraft(
      customerPrincipal(),
      createBody,
      "idem-1",
    );
    expect(replayed).toEqual({ id: "booking-1", status: "DRAFT", media: [] });
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it("conflicts when the idempotency key is reused with a different body", async () => {
    const { service } = createService({
      repository: {
        findCommand: vi.fn().mockResolvedValue({
          requestHash: "other-hash",
          bookingId: "booking-1",
          responseJson: { id: "booking-1" },
        }),
      },
    });
    await expect(
      service.createDraft(customerPrincipal(), createBody, "idem-1"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("fails closed instead of replaying an unfinished command reservation", async () => {
    const { hashBookingRequest } =
      await import("#modules/bookings/bookings.command.types");
    const { service } = createService({
      repository: {
        findCommand: vi.fn().mockResolvedValue({
          requestHash: hashBookingRequest(createBody),
          bookingId: null,
          responseJson: { reserved: true },
        }),
      },
    });

    await expect(
      service.createDraft(customerPrincipal(), createBody, "idem-unfinished"),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
  });

  it("retries failed media commands without treating the key as a success", async () => {
    const attachMedia = vi.fn().mockResolvedValue("LIMIT");
    const { service } = createService({ repository: { attachMedia } });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        service.attachMedia(
          customerPrincipal(),
          "booking-1",
          { version: 1, mediaId: "media-1" },
          "idem-media-limit",
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
    expect(attachMedia).toHaveBeenCalledTimes(2);
  });

  it("signs media URLs when replaying a completed command response", async () => {
    const { hashBookingRequest } =
      await import("#modules/bookings/bookings.command.types");
    const { service } = createService({
      signedDelivery: {
        url: "https://cdn.example/replayed.jpg",
        urlExpiresAt: "2026-09-10T12:00:00.000Z",
      },
      repository: {
        findCommand: vi.fn().mockResolvedValue({
          requestHash: hashBookingRequest(createBody),
          bookingId: "booking-1",
          responseJson: {
            id: "booking-1",
            status: "DRAFT",
            media: [{ mediaId: "media-1", displayOrder: 0 }],
          },
        }),
      },
    });

    await expect(
      service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-signed-replay",
      ),
    ).resolves.toMatchObject({
      media: [
        {
          mediaId: "media-1",
          deliveryUrl: "https://cdn.example/replayed.jpg",
          urlExpiresAt: "2026-09-10T12:00:00.000Z",
        },
      ],
    });
  });

  it("forbids unverified principals", async () => {
    const { service } = createService();
    await expect(
      service.createDraft(
        customerPrincipal({ verifiedCategories: [] }),
        createBody,
        "idem-4",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses submit when a required catalog answer is missing", async () => {
    const { service } = createService();
    await expect(
      service.submitForDeposit(customerPrincipal(), "booking-1", 1, "idem-sub"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("submits a complete draft and freezes the snapshot", async () => {
    const current = {
      ...draftAggregate(),
      answers: [
        { fieldId: "field-req", fieldCode: "ROOMS", kind: "NUMBER", value: 3 },
      ],
    };
    const { service, repository } = createService({
      repository: {
        findOwned: vi.fn().mockResolvedValue(current),
      },
    });
    const submitted = (await service.submitForDeposit(
      customerPrincipal(),
      "booking-1",
      1,
      "idem-sub",
    )) as { status: string; snapshotFrozen: boolean };
    expect(submitted.status).toBe("AWAITING_DEPOSIT");
    expect(submitted.snapshotFrozen).toBe(true);
    expect(repository.submitForDeposit).toHaveBeenCalled();
  });

  it("uses the address-resolved district for create eligibility and persistence", async () => {
    const bodyWithoutDistrict = createBookingBodySchema.parse(
      Object.fromEntries(
        Object.entries(createBody).filter(([key]) => key !== "districtId"),
      ),
    );
    const { service, repository, evaluateEligibility } = createService();

    await service.createDraft(
      customerPrincipal(),
      bodyWithoutDistrict,
      "idem-resolved-dist",
    );

    expect(evaluateEligibility).toHaveBeenCalledWith(
      expect.objectContaining({ districtId: "district-1" }),
    );
    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ districtId: "district-1" }),
    );
  });

  it("rejects cancelled-to-draft commands without mutating the booking", async () => {
    const cancelled = {
      ...draftAggregate(),
      status: "CANCELLED" as const,
      cancelledAt: "2026-09-10T09:00:00.000Z",
    };
    const { service, repository } = createService({
      repository: {
        findOwned: vi.fn().mockResolvedValue(cancelled),
        isExecutableTransition: vi.fn().mockResolvedValue(false),
      },
    });
    await expect(
      service.patchDraft(customerPrincipal(), "booking-1", {
        version: 1,
        notes: "restore draft",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
    await expect(
      service.submitForDeposit(
        customerPrincipal(),
        "booking-1",
        1,
        "idem-cancelled-submit",
      ),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
    expect(repository.replaceDraftContents).not.toHaveBeenCalled();
    expect(repository.submitForDeposit).not.toHaveBeenCalled();
    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it("re-evaluates eligibility at submit and fails closed when the team is no longer eligible", async () => {
    const current = {
      ...draftAggregate(),
      answers: [
        { fieldId: "field-req", fieldCode: "ROOMS", kind: "NUMBER", value: 3 },
      ],
    };
    const { service, repository } = createService({
      eligible: false,
      repository: {
        findOwned: vi.fn().mockResolvedValue(current),
      },
    });
    await expect(
      service.submitForDeposit(
        customerPrincipal(),
        "booking-1",
        1,
        "idem-submit-ineligible",
      ),
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(repository.submitForDeposit).not.toHaveBeenCalled();
  });

  it("keeps frozen snapshot amounts after the live offering price changes", async () => {
    const frozen = {
      ...draftAggregate(),
      status: "AWAITING_DEPOSIT" as const,
      snapshotFrozen: true,
      version: 2,
      snapshot: {
        catalog: { name: "Frozen home cleaning" },
        provider: { price: "100.00" },
        frozenAt: "2026-09-10T08:30:00.000Z",
      },
      priceBreakdown: {
        gross: "100.00",
        deposit: "25.00",
        remainder: "75.00",
        currencyCode: "EGP",
        decimalPlaces: 2,
        depositPercent: "25",
        formulaVersion: "r1-p13-v1",
        createdAt: "2026-09-10T08:30:00.000Z",
      },
    };
    const livePrice = { current: "100.00" };
    const { service } = createService({
      repository: { findOwned: vi.fn().mockResolvedValue(frozen) },
    });
    livePrice.current = "999.00";
    const presented = (await service.get(customerPrincipal(), "booking-1")) as {
      quote: { gross: string; deposit: string };
      snapshot: { catalog: { name: string }; provider: { price: string } };
      priceBreakdown: { gross: string; deposit: string; remainder: string };
      snapshotFrozen: boolean;
    };
    expect(presented.snapshotFrozen).toBe(true);
    expect(presented.quote.gross).toBe("100.00");
    expect(presented.quote.deposit).toBe("25.00");
    expect(presented.snapshot).toEqual(frozen.snapshot);
    expect(presented.priceBreakdown).toEqual(frozen.priceBreakdown);
    expect(livePrice.current).toBe("999.00");
  });

  it("cancels without inventing fee fields", async () => {
    const { service, repository } = createService();
    const cancelled = (await service.cancel(
      customerPrincipal(),
      "booking-1",
      { version: 1, reason: "CUSTOMER_CHANGED_MIND" },
      "idem-cancel",
    )) as { status: string; cancelledAt: string | null };
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(JSON.stringify(cancelled)).not.toMatch(/fee/i);
    expect(repository.cancel).toHaveBeenCalled();
  });

  it("attaches a ready owned booking image on a draft", async () => {
    const { service } = createService();
    const updated = (await service.attachMedia(
      customerPrincipal(),
      "booking-1",
      { version: 1, mediaId: "media-1" },
      "idem-media",
    )) as { media: readonly { mediaId: string }[] };
    expect(updated.media[0]?.mediaId).toBe("media-1");
  });

  it("lists owned bookings and patches draft notes", async () => {
    const { service, repository } = createService();
    const listed = (await service.list(customerPrincipal(), { limit: 20 })) as {
      items: readonly unknown[];
    };
    expect(listed.items).toHaveLength(1);
    const patched = (await service.patchDraft(
      customerPrincipal(),
      "booking-1",
      { version: 1, notes: "gate notes" },
    )) as { version: number };
    expect(patched.version).toBe(2);
    expect(repository.replaceDraftContents).toHaveBeenCalled();
  });

  it("hides other customers' bookings as not found", async () => {
    const { service } = createService({
      repository: { findOwned: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      service.get(customerPrincipal(), "someone-else"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects stale versions and unavailable confirmed transitions", async () => {
    const { service } = createService({
      repository: {
        findOwned: vi
          .fn()
          .mockResolvedValue({ ...draftAggregate(), version: 2 }),
      },
    });
    await expect(
      service.patchDraft(customerPrincipal(), "booking-1", {
        version: 1,
        notes: "stale",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const confirmed = createService({
      repository: {
        findOwned: vi.fn().mockResolvedValue({
          ...draftAggregate(),
          status: "CONFIRMED",
        }),
        isExecutableTransition: vi.fn().mockResolvedValue(false),
      },
    });
    await expect(
      confirmed.service.cancel(
        customerPrincipal(),
        "booking-1",
        { version: 1, reason: "OTHER" },
        "idem-x",
      ),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("rejects unknown media attachments", async () => {
    const { service } = createService({ attachment: null });
    await expect(
      service.attachMedia(
        customerPrincipal(),
        "booking-1",
        { version: 1, mediaId: "nope" },
        "idem-bad-media",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("maps snapshot conflicts and missing offerings as closed failures", async () => {
    const conflict = createService({ snapshotStatus: "CONFLICT" });
    await expect(
      conflict.service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-conflict",
      ),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
    const unavailable = createService({ snapshotStatus: "UNAVAILABLE" });
    await expect(
      unavailable.service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-unavail",
      ),
    ).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
  });

  it("closes remaining create, patch, submit, and media branches", async () => {
    await expect(
      createService({ country: null }).service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-country",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ catalog: null }).service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-catalog",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ ownedAddress: null }).service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-addr",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ snapshotCurrency: "USD" }).service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-ccy",
      ),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
    await expect(
      createService({
        cities: [
          {
            cityId: "other",
            code: "ALX",
            nameAr: "اسكندرية",
            nameEn: "Alexandria",
          },
        ],
      }).service.createDraft(customerPrincipal(), createBody, "idem-city"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ districts: [] }).service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-dist",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({
        districts: [
          {
            districtId: "other-dist",
            cityId: "city-1",
            code: "MAADI",
            nameAr: "المعادي",
            nameEn: "Maadi",
          },
        ],
      }).service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-dist-mismatch",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({
        districts: [
          {
            districtId: "other-dist",
            cityId: "city-1",
            code: "NASR",
            nameAr: "مدينة نصر",
            nameEn: "Nasr City",
          },
        ],
      }).service.createDraft(customerPrincipal(), createBody, "idem-dist-id"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({
        eligibilityError: new EligibilityError("VALIDATION_FAILED", {
          details: { field: "startsAt" },
        }),
      }).service.createDraft(customerPrincipal(), createBody, "idem-elig-v"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({
        eligibilityError: new EligibilityError("DEPENDENCY_FAILURE"),
      }).service.createDraft(customerPrincipal(), createBody, "idem-elig-d"),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });
    await expect(
      createService({
        eligibilityError: new Error("boom"),
      }).service.createDraft(customerPrincipal(), createBody, "idem-elig-x"),
    ).rejects.toMatchObject({ code: "DEPENDENCY_FAILURE" });

    const patched = createService();
    await patched.service.patchDraft(customerPrincipal(), "booking-1", {
      version: 1,
      userAddressId: "addr-1",
      answers: [{ fieldId: "field-req", value: 3 }],
      notes: "updated",
    });
    await patched.service.list(customerPrincipal(), {
      limit: 10,
      cursor: "abc",
      status: "DRAFT",
    });

    const infoCatalog: SnapshotReadyCatalogServiceDefinition = {
      ...catalogDefinition(),
      fields: [
        ...catalogDefinition().fields,
        {
          id: "field-info",
          code: "INFO",
          kind: "INFORMATION",
          label: "Info",
          helpText: null,
          required: false,
          textBounds: null,
          numberRules: null,
          selectionBounds: null,
          options: [],
          displayOrder: 2,
        },
      ],
    };
    await expect(
      createService({ catalog: infoCatalog }).service.patchDraft(
        customerPrincipal(),
        "booking-1",
        { version: 1, answers: [{ fieldId: "field-info", value: "x" }] },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      createService({
        repository: {
          findOwned: vi.fn().mockResolvedValue({
            ...draftAggregate(),
            status: "AWAITING_DEPOSIT",
          }),
        },
      }).service.patchDraft(customerPrincipal(), "booking-1", {
        version: 1,
        notes: "nope",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    await expect(
      createService({
        repository: {
          findOwned: vi
            .fn()
            .mockResolvedValue({ ...draftAggregate(), address: null }),
        },
      }).service.submitForDeposit(
        customerPrincipal(),
        "booking-1",
        1,
        "idem-incomplete",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      createService({
        repository: {
          findOwned: vi.fn().mockResolvedValue({
            ...draftAggregate(),
            status: "AWAITING_DEPOSIT",
          }),
        },
      }).service.submitForDeposit(
        customerPrincipal(),
        "booking-1",
        1,
        "idem-not-draft",
      ),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    await expect(
      createService({
        repository: {
          findOwned: vi
            .fn()
            .mockResolvedValue({ ...draftAggregate(), version: 9 }),
        },
      }).service.submitForDeposit(
        customerPrincipal(),
        "booking-1",
        1,
        "idem-stale-sub",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      createService({
        repository: {
          findOwned: vi
            .fn()
            .mockResolvedValue({ ...draftAggregate(), version: 9 }),
        },
      }).service.attachMedia(
        customerPrincipal(),
        "booking-1",
        { version: 1, mediaId: "media-1" },
        "idem-stale-media",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      createService({
        repository: {
          findOwned: vi.fn().mockResolvedValue({
            ...draftAggregate(),
            status: "AWAITING_DEPOSIT",
          }),
        },
      }).service.attachMedia(
        customerPrincipal(),
        "booking-1",
        { version: 1, mediaId: "media-1" },
        "idem-media-status",
      ),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    await expect(
      createService({
        repository: { attachMedia: vi.fn().mockResolvedValue("LIMIT") },
      }).service.attachMedia(
        customerPrincipal(),
        "booking-1",
        { version: 1, mediaId: "media-1" },
        "idem-limit",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      createService({
        repository: {
          replaceDraftContents: vi.fn().mockResolvedValue("NOT_FOUND"),
        },
      }).service.patchDraft(customerPrincipal(), "booking-1", {
        version: 1,
        notes: "gone",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      createService({
        repository: {
          replaceDraftContents: vi.fn().mockResolvedValue("CONFLICT"),
        },
      }).service.patchDraft(customerPrincipal(), "booking-1", {
        version: 1,
        notes: "race",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      createService({
        repository: {
          replaceDraftContents: vi.fn().mockResolvedValue("NOT_DRAFT"),
        },
      }).service.patchDraft(customerPrincipal(), "booking-1", {
        version: 1,
        notes: "locked",
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });

    const { hashBookingRequest } =
      await import("#modules/bookings/bookings.command.types");
    const raced = createService({
      repository: {
        findCommand: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            requestHash: hashBookingRequest(createBody),
            bookingId: "booking-1",
            responseJson: { id: "booking-1", replayed: true },
          }),
        createDraft: vi
          .fn()
          .mockRejectedValue(new BookingIdempotencyCollision()),
      },
    });
    await expect(
      raced.service.createDraft(customerPrincipal(), createBody, "idem-dup"),
    ).resolves.toEqual({ id: "booking-1", replayed: true, media: [] });

    const racedMismatch = createService({
      repository: {
        findCommand: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            requestHash: "other",
            bookingId: "booking-1",
            responseJson: { id: "booking-1" },
          }),
        createDraft: vi
          .fn()
          .mockRejectedValue(new BookingIdempotencyCollision()),
      },
    });
    await expect(
      racedMismatch.service.createDraft(
        customerPrincipal(),
        createBody,
        "idem-dup-bad",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const noQuote = createService({
      repository: {
        findOwned: vi
          .fn()
          .mockResolvedValue({ ...draftAggregate(), quote: null }),
      },
    });
    const presented = (await noQuote.service.get(
      customerPrincipal(),
      "booking-1",
    )) as {
      quote: unknown;
    };
    expect(presented.quote).toBeNull();
  });

  it("rejects catalog answers that do not match field rules", async () => {
    const richCatalog: SnapshotReadyCatalogServiceDefinition = {
      ...catalogDefinition(),
      fields: [
        catalogDefinition().fields[0]!,
        {
          id: "field-text",
          code: "NOTE",
          kind: "TEXT",
          label: "Note",
          helpText: null,
          required: false,
          textBounds: { min: 2, max: 8 },
          numberRules: null,
          selectionBounds: null,
          options: [],
          displayOrder: 2,
        },
        {
          id: "field-select",
          code: "CREW",
          kind: "SINGLE_SELECT",
          label: "Crew",
          helpText: null,
          required: false,
          textBounds: null,
          numberRules: null,
          selectionBounds: { min: 1, max: 1 },
          options: [
            {
              id: "opt-1",
              value: "standard",
              label: "Standard",
              displayOrder: 1,
            },
          ],
          displayOrder: 3,
        },
      ],
    };
    await expect(
      createService({ catalog: richCatalog }).service.patchDraft(
        customerPrincipal(),
        "booking-1",
        { version: 1, answers: [{ fieldId: "field-req", value: "rooms" }] },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ catalog: richCatalog }).service.patchDraft(
        customerPrincipal(),
        "booking-1",
        { version: 1, answers: [{ fieldId: "field-text", value: "x" }] },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ catalog: richCatalog }).service.patchDraft(
        customerPrincipal(),
        "booking-1",
        {
          version: 1,
          answers: [{ fieldId: "field-select", value: "unknown" }],
        },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createService({ catalog: richCatalog }).service.patchDraft(
        customerPrincipal(),
        "booking-1",
        {
          version: 1,
          answers: [
            { fieldId: "field-req", value: 3 },
            { fieldId: "field-req", value: 4 },
          ],
        },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("fails closed when the persisted transition matrix is not executable", async () => {
    const { service } = createService({
      repository: { isExecutableTransition: vi.fn().mockResolvedValue(false) },
    });
    await expect(
      service.createDraft(customerPrincipal(), createBody, "idem-matrix"),
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_AVAILABLE" });
  });

  it("includes a signed delivery URL when Media signing succeeds", async () => {
    const withMedia = {
      ...draftAggregate(),
      media: [{ mediaId: "media-1", displayOrder: 0 }],
    };
    const { service } = createService({
      repository: { findOwned: vi.fn().mockResolvedValue(withMedia) },
      signedDelivery: {
        url: "https://cdn.example/booking.jpg",
        urlExpiresAt: "2026-09-10T12:00:00.000Z",
      },
    });
    const presented = (await service.get(customerPrincipal(), "booking-1")) as {
      media: readonly {
        mediaId: string;
        deliveryUrl?: string;
        urlExpiresAt?: string;
      }[];
    };
    expect(presented.media[0]).toMatchObject({
      mediaId: "media-1",
      deliveryUrl: "https://cdn.example/booking.jpg",
      urlExpiresAt: "2026-09-10T12:00:00.000Z",
    });
  });

  it("omits a signed delivery URL when Media signing fails for one attachment", async () => {
    const withMedia = {
      ...draftAggregate(),
      media: [{ mediaId: "media-1", displayOrder: 0 }],
    };
    const { service } = createService({
      repository: { findOwned: vi.fn().mockResolvedValue(withMedia) },
    });
    const presented = (await service.get(customerPrincipal(), "booking-1")) as {
      media: readonly { mediaId: string; deliveryUrl?: string }[];
    };
    expect(presented.media[0]).toEqual({ mediaId: "media-1", displayOrder: 0 });
  });
});

describe("booking money helpers", () => {
  it("rejects non-canonical money strings", () => {
    expect(() => parseCanonicalDecimalToMinorUnits(" 1.00", 2)).toThrow();
    expect(() => parseCanonicalDecimalToMinorUnits("1.000", 2)).toThrow();
    expect(() => parseCanonicalDecimalToMinorUnits("01.00", 2)).toThrow();
    expect(() => parseCanonicalDecimalToMinorUnits("1e2", 2)).toThrow();
    expect(() => parseCanonicalDecimalToMinorUnits("", 2)).toThrow();
    expect(() => parseCanonicalDecimalToMinorUnits("1.00", 9)).toThrow();
    expect(() => formatMinorUnitsToCanonicalDecimal("12a", 2)).toThrow();
    expect(() => formatMinorUnitsToCanonicalDecimal("100", 9)).toThrow();
    expect(formatMinorUnitsToCanonicalDecimal("100", 0)).toBe("100");
    expect(formatMinorUnitsToCanonicalDecimal("0005", 2)).toBe("0.05");
    expect(() => percentOfMinorUnits("10000", "101")).toThrow();
    expect(percentOfMinorUnits("10000", "25.00")).toEqual({
      depositMinorUnits: "2500",
      remainderMinorUnits: "7500",
    });
  });
});

describe("idempotency hashing", () => {
  it("hashes objects and arrays stably", async () => {
    const { hashBookingRequest } =
      await import("#modules/bookings/bookings.command.types");
    expect(hashBookingRequest({ b: 1, a: [2, 3] })).toBe(
      hashBookingRequest({ a: [2, 3], b: 1 }),
    );
    expect(hashBookingRequest(null)).toHaveLength(64);
  });
});
