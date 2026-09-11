import type { Express } from "express";
import request from "supertest";

import { createAuthenticateAccess } from "#modules/authentication/auth.middleware";
import { authenticationError } from "#modules/authentication/domain/authentication.errors";
import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { createBookingsCommandRouter } from "#modules/bookings/bookings.command.routes";
import { BookingsCommandService } from "#modules/bookings/bookings.command.service";
import {
  hashBookingRequest,
  type BookingsCommandRepository,
} from "#modules/bookings/bookings.command.types";
import { quoteBooking } from "#modules/bookings/bookings.quote";
import { createErrorMiddleware } from "#middlewares/error.middleware";
import { requestIdMiddleware } from "#middlewares/request-id.middleware";
import type { Logger } from "#shared/logger";

const express = require("express") as typeof import("express");

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

const CREATE_BODY = {
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
};

function principal(
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

function frozenQuote() {
  return quoteBooking({
    currencyCode: "EGP",
    decimalPlaces: 2,
    priceAmount: "100.00",
    minimumChargeAmount: "80.00",
    depositPercent: "25",
  });
}

function createCommandApp(options: {
  readonly eligible?: boolean;
  readonly createDraft?: ReturnType<typeof vi.fn>;
  readonly findOwned?: ReturnType<typeof vi.fn>;
  readonly findCommand?: ReturnType<typeof vi.fn>;
  readonly attachMedia?: ReturnType<typeof vi.fn>;
  readonly listOwned?: ReturnType<typeof vi.fn>;
  readonly requiredCatalogField?: boolean;
  readonly rateLimiter?: { consume: ReturnType<typeof vi.fn> };
}): {
  readonly app: Express;
  readonly createDraft: ReturnType<typeof vi.fn>;
  readonly rateConsume: ReturnType<typeof vi.fn>;
} {
  const quote = frozenQuote();
  const createDraft =
    options.createDraft ??
    vi.fn().mockResolvedValue({
      id: "booking-1",
      customerUserId: "user-1",
      countryId: "country-1",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      status: "DRAFT",
      serviceId: "service-1",
      providerId: "provider-1",
      teamId: "team-1",
      cityId: "city-1",
      districtId: "district-1",
      startsAt: CREATE_BODY.startsAt,
      endsAt: CREATE_BODY.endsAt,
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "AR",
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
      statusHistory: [],
      snapshot: null,
      priceBreakdown: null,
      snapshotFrozen: false,
      cancelledAt: null,
      submittedAt: null,
      createdAt: "2026-09-10T07:00:00.000Z",
    });
  const repository = {
    isExecutableTransition: vi.fn().mockResolvedValue(true),
    findCommand: options.findCommand ?? vi.fn().mockResolvedValue(null),
    createDraft,
    findOwned:
      options.findOwned ??
      vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        status: "AWAITING_DEPOSIT",
        snapshotFrozen: true,
        quote,
        version: 1,
        media: [],
        answers: [],
        statusHistory: [{ reasonCode: "CUSTOMER_CHANGED_MIND" }],
        cancelledAt: null,
        emergencySignaled: false,
      }),
    listOwned:
      options.listOwned ??
      vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    replaceDraftContents: vi.fn(),
    attachMedia: options.attachMedia ?? vi.fn(),
    submitForDeposit: vi.fn(),
    cancel: vi.fn().mockResolvedValue({
      id: "booking-1",
      status: "CANCELLED",
      cancelledAt: "2026-09-10T09:00:00.000Z",
      statusHistory: [{ reasonCode: "CUSTOMER_CHANGED_MIND" }],
      quote,
      media: [],
      answers: [],
      emergencySignaled: false,
    }),
  } as BookingsCommandRepository;
  const service = new BookingsCommandService({
    repository,
    eligibility: {
      evaluateEligibility: vi.fn().mockResolvedValue({
        evaluationId: "eval-1",
        eligibleTeams:
          options.eligible === false
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
      }),
    },
    catalog: {
      getSnapshotReadyDefinitionById: vi.fn().mockResolvedValue({
        serviceId: "service-1",
        serviceCode: "HOME_CLEANING",
        serviceVersion: 1,
        category: { id: "cat", code: "HOME", name: "Home", description: "" },
        locale: "AR",
        countryCode: "EG",
        name: "Home cleaning",
        description: "",
        priceUnits: [],
        fields: options.requiredCatalogField
          ? [
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
            ]
          : [],
        media: [],
      }),
    },
    locality: {
      listActiveCitiesForCountry: vi
        .fn()
        .mockResolvedValue([
          { cityId: "city-1", code: "CAI", nameAr: "القاهرة", nameEn: "Cairo" },
        ]),
      listActiveDistrictsForCity: vi.fn().mockResolvedValue([
        {
          districtId: "district-1",
          cityId: "city-1",
          code: "NASR",
          nameAr: "مدينة نصر",
          nameEn: "Nasr City",
        },
      ]),
    },
    depositPercent: {
      readForCountryId: vi.fn().mockResolvedValue({
        countryId: "country-1",
        countryCode: "EG",
        currencyCode: "EGP",
        decimalPlaces: 2,
        percentCanonical: "25",
      }),
    },
    addresses: {
      readOwnedAddress: vi.fn().mockResolvedValue({
        id: "addr-1",
        countryCode: "EG",
        city: "Cairo",
        district: "Nasr City",
        addressText: "1 Main St",
        building: null,
        floor: null,
        notes: null,
      }),
    },
    attachments: {
      readOwnedReadyImage: vi.fn().mockResolvedValue(null),
      signOwnedReadyImage: vi.fn().mockResolvedValue(null),
    },
    serviceSnapshots: {
      getSnapshotReadyFacts: vi.fn().mockResolvedValue({
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
          currencyCode: "EGP",
          effectiveAt: "2026-09-01T00:00:00.000Z",
          priceUnit: { id: "unit-1", code: "VISIT", label: "Visit" },
          catalogDefinition: { fields: [] },
        },
      }),
    },
    activeCountries: {
      getActiveCountryById: vi
        .fn()
        .mockResolvedValue({ id: "country-1", code: "EG" }),
    },
  });
  const authenticateAccess = createAuthenticateAccess({
    authenticateAccess: async (token: string) => {
      if (token === "verified") {
        return principal();
      }
      if (token === "unverified") {
        return principal({ verifiedCategories: [] });
      }
      if (token === "invitation") {
        return principal({ invitationOnboardingOnly: true });
      }
      if (token === "verification-only") {
        return principal({ verificationOnly: true });
      }
      if (token === "user-2") {
        return principal({ userId: "user-2" });
      }
      throw authenticationError("AUTHENTICATION_REQUIRED");
    },
  } as never);
  const rateConsume =
    options.rateLimiter?.consume ??
    vi.fn().mockResolvedValue({ allowed: true, remaining: 29 });
  const router = createBookingsCommandRouter({
    authenticateAccess,
    rateLimiter: {
      consume: rateConsume as never,
    },
    privacyHashSecret: "integration-booking-privacy-secret-32chars!",
    service,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use("/api/v1/bookings", router);
  app.use(createErrorMiddleware(logger));
  return { app, createDraft, rateConsume };
}

describe("R1-P13 booking command HTTP integration", () => {
  it("rejects guests and unverified customers without creating a booking", async () => {
    const harness = createCommandApp({});
    const guest = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Idempotency-Key", "idem-guest")
      .send(CREATE_BODY)
      .expect(401);
    expect(guest.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(harness.createDraft).not.toHaveBeenCalled();

    const unverified = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer unverified")
      .set("Idempotency-Key", "idem-unverified")
      .send(CREATE_BODY)
      .expect(403);
    expect(unverified.body.error.code).toBe("FORBIDDEN");
    expect(harness.createDraft).not.toHaveBeenCalled();
  });

  it("rejects an ineligible selected team", async () => {
    const harness = createCommandApp({ eligible: false });
    const response = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-ineligible")
      .send(CREATE_BODY)
      .expect(409);
    expect(response.body.error.code).toBe("NOT_ELIGIBLE");
    expect(harness.createDraft).not.toHaveBeenCalled();
  });

  it("returns frozen snapshot amounts after the live offering price would have changed", async () => {
    const quote = frozenQuote();
    const findOwned = vi.fn().mockResolvedValue({
      id: "booking-1",
      customerUserId: "user-1",
      countryId: "country-1",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      status: "AWAITING_DEPOSIT",
      serviceId: "service-1",
      providerId: "provider-1",
      teamId: "team-1",
      cityId: "city-1",
      districtId: "district-1",
      startsAt: CREATE_BODY.startsAt,
      endsAt: CREATE_BODY.endsAt,
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "AR",
      notes: null,
      emergencySignaled: false,
      version: 2,
      depositPercent: "25.00",
      quote,
      eligibilityEvaluationId: "eval-1",
      item: null,
      address: null,
      answers: [],
      media: [],
      statusHistory: [],
      snapshot: {
        catalog: {
          serviceId: "service-1",
          serviceCode: "HOME_CLEANING",
          name: "Frozen home cleaning",
        },
        provider: {
          providerId: "provider-1",
          providerServicePriceId: "price-frozen",
          price: "100.00",
        },
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
      snapshotFrozen: true,
      cancelledAt: null,
      submittedAt: "2026-09-10T08:30:00.000Z",
      createdAt: "2026-09-10T07:00:00.000Z",
    });
    const harness = createCommandApp({ findOwned });
    const first = await request(harness.app)
      .get("/api/v1/bookings/booking-1")
      .set("Authorization", "Bearer verified")
      .expect(200);
    expect(first.body.data).toMatchObject({
      snapshotFrozen: true,
      quote: { gross: "100.00", deposit: "25.00" },
      snapshot: {
        catalog: { name: "Frozen home cleaning" },
        provider: { providerServicePriceId: "price-frozen", price: "100.00" },
      },
      priceBreakdown: {
        gross: "100.00",
        deposit: "25.00",
        remainder: "75.00",
      },
    });
    const second = await request(harness.app)
      .get("/api/v1/bookings/booking-1")
      .set("Authorization", "Bearer verified")
      .expect(200);
    expect(second.body.data.quote).toMatchObject({
      gross: "100.00",
      deposit: "25.00",
      remainder: "75.00",
    });
  });

  it("cancels without storing a fee amount", async () => {
    const harness = createCommandApp({});
    const response = await request(harness.app)
      .post("/api/v1/bookings/booking-1/cancel")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-cancel")
      .send({ version: 1, reason: "CUSTOMER_CHANGED_MIND" })
      .expect(200);
    expect(response.body.data.status).toBe("CANCELLED");
    expect(JSON.stringify(response.body)).not.toMatch(/fee/i);
  });

  it("rejects invitation-onboarding and verification-only principals", async () => {
    const harness = createCommandApp({});
    const invitation = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer invitation")
      .set("Idempotency-Key", "idem-invitation")
      .send(CREATE_BODY)
      .expect(403);
    expect(invitation.body.error.code).toBe("FORBIDDEN");
    expect(harness.createDraft).not.toHaveBeenCalled();

    const verificationOnly = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer verification-only")
      .set("Idempotency-Key", "idem-verification")
      .send(CREATE_BODY)
      .expect(403);
    expect(verificationOnly.body.error.code).toBe("AUTH_VERIFICATION_REQUIRED");
    expect(harness.createDraft).not.toHaveBeenCalled();
  });

  it("hides another customer's booking as not found", async () => {
    const harness = createCommandApp({
      findOwned: vi.fn().mockResolvedValue(null),
    });
    const response = await request(harness.app)
      .get("/api/v1/bookings/booking-foreign")
      .set("Authorization", "Bearer verified")
      .expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("lists only the caller's bookings", async () => {
    const quote = frozenQuote();
    const owned = {
      id: "booking-1",
      customerUserId: "user-1",
      countryId: "country-1",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      status: "DRAFT",
      serviceId: "service-1",
      providerId: "provider-1",
      teamId: "team-1",
      cityId: "city-1",
      districtId: "district-1",
      startsAt: CREATE_BODY.startsAt,
      endsAt: CREATE_BODY.endsAt,
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "AR",
      notes: null,
      emergencySignaled: false,
      version: 1,
      depositPercent: "25.00",
      quote,
      eligibilityEvaluationId: "eval-1",
      item: null,
      address: null,
      answers: [],
      media: [],
      statusHistory: [],
      snapshotFrozen: false,
      cancelledAt: null,
      submittedAt: null,
      createdAt: "2026-09-10T07:00:00.000Z",
    };
    const listOwned = vi.fn(async (input: { customerUserId: string }) => ({
      items: input.customerUserId === "user-1" ? [owned] : [],
      nextCursor: null,
    }));
    const harness = createCommandApp({ listOwned });
    const own = await request(harness.app)
      .get("/api/v1/bookings")
      .set("Authorization", "Bearer verified")
      .expect(200);
    expect(own.body.data.items).toHaveLength(1);
    expect(own.body.data.items[0].id).toBe("booking-1");

    const other = await request(harness.app)
      .get("/api/v1/bookings")
      .set("Authorization", "Bearer user-2")
      .expect(200);
    expect(other.body.data.items).toEqual([]);
    expect(listOwned).toHaveBeenCalledWith(
      expect.objectContaining({ customerUserId: "user-2" }),
    );
  });

  it("rejects a stale submit version", async () => {
    const harness = createCommandApp({
      findOwned: vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        status: "DRAFT",
        version: 2,
        snapshotFrozen: false,
        quote: frozenQuote(),
        media: [],
        answers: [],
        item: { catalogServiceId: "service-1" },
        address: { sourceUserAddressId: "addr-1" },
        statusHistory: [],
        cancelledAt: null,
        emergencySignaled: false,
      }),
    });
    const response = await request(harness.app)
      .post("/api/v1/bookings/booking-1/submit-for-deposit")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-stale")
      .send({ version: 1 })
      .expect(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("rejects CONFIRMED and other non-executable transitions", async () => {
    const harness = createCommandApp({
      findOwned: vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        status: "AWAITING_DEPOSIT",
        version: 2,
        snapshotFrozen: true,
        quote: frozenQuote(),
        media: [],
        answers: [],
        item: { catalogServiceId: "service-1" },
        address: { sourceUserAddressId: "addr-1" },
        statusHistory: [],
        cancelledAt: null,
        emergencySignaled: false,
      }),
    });
    const confirmRoute = await request(harness.app)
      .post("/api/v1/bookings/booking-1/confirm")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-confirm")
      .send({ version: 2 })
      .expect(404);
    expect(confirmRoute.status).toBe(404);

    const resubmit = await request(harness.app)
      .post("/api/v1/bookings/booking-1/submit-for-deposit")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-resubmit")
      .send({ version: 2 })
      .expect(409);
    expect(resubmit.body.error.code).toBe("TRANSITION_NOT_AVAILABLE");
  });

  it("replays an identical idempotent create without a second draft", async () => {
    const findCommand = vi.fn().mockResolvedValue({
      requestHash: hashBookingRequest(CREATE_BODY),
      bookingId: "booking-1",
      responseJson: { id: "booking-1", status: "DRAFT" },
    });
    const harness = createCommandApp({ findCommand });
    const first = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-replay")
      .send(CREATE_BODY)
      .expect(201);
    const second = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-replay")
      .send(CREATE_BODY)
      .expect(201);
    expect(first.body.data.id).toBe("booking-1");
    expect(second.body.data.id).toBe("booking-1");
    expect(harness.createDraft).not.toHaveBeenCalled();
  });

  it("keeps a draft when required catalog answers are missing on submit", async () => {
    const harness = createCommandApp({
      requiredCatalogField: true,
      findOwned: vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        status: "DRAFT",
        version: 1,
        snapshotFrozen: false,
        quote: frozenQuote(),
        media: [],
        answers: [],
        item: { catalogServiceId: "service-1" },
        address: { sourceUserAddressId: "addr-1" },
        serviceId: "service-1",
        providerId: "provider-1",
        teamId: "team-1",
        countryId: "country-1",
        cityId: "city-1",
        districtId: "district-1",
        startsAt: CREATE_BODY.startsAt,
        endsAt: CREATE_BODY.endsAt,
        crewPreference: "any",
        requiredTeamUnits: 1,
        locale: "AR",
        notes: null,
        statusHistory: [],
        cancelledAt: null,
        emergencySignaled: false,
      }),
    });
    const response = await request(harness.app)
      .post("/api/v1/bookings/booking-1/submit-for-deposit")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-missing-answer")
      .send({ version: 1 })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a sixth booking image", async () => {
    const harness = createCommandApp({
      findOwned: vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        status: "DRAFT",
        version: 1,
        snapshotFrozen: false,
        quote: frozenQuote(),
        media: [],
        answers: [],
        item: { catalogServiceId: "service-1" },
        address: { sourceUserAddressId: "addr-1" },
        statusHistory: [],
        cancelledAt: null,
        emergencySignaled: false,
      }),
      attachMedia: vi.fn().mockResolvedValue("LIMIT"),
    });
    const response = await request(harness.app)
      .post("/api/v1/bookings/booking-1/media")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-sixth")
      .send({ version: 1, mediaId: "media-6" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rate-limits create and submit only", async () => {
    const denied = vi.fn().mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    });
    const harness = createCommandApp({ rateLimiter: { consume: denied } });
    const created = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-limited")
      .send(CREATE_BODY)
      .expect(429);
    expect(created.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(harness.createDraft).not.toHaveBeenCalled();

    const submitted = await request(harness.app)
      .post("/api/v1/bookings/booking-1/submit-for-deposit")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-limited-submit")
      .send({ version: 1 })
      .expect(429);
    expect(submitted.body.error.code).toBe("RATE_LIMIT_EXCEEDED");

    denied.mockClear();
    await request(harness.app)
      .get("/api/v1/bookings/booking-1")
      .set("Authorization", "Bearer verified")
      .expect(200);
    await request(harness.app)
      .post("/api/v1/bookings/booking-1/cancel")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-limited-cancel")
      .send({ version: 1, reason: "CUSTOMER_CHANGED_MIND" })
      .expect(200);
    expect(denied).not.toHaveBeenCalled();
  });

  it("rejects client-authored totals at the HTTP boundary", async () => {
    const harness = createCommandApp({});
    const response = await request(harness.app)
      .post("/api/v1/bookings")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-totals")
      .send({ ...CREATE_BODY, gross: "1.00" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(harness.createDraft).not.toHaveBeenCalled();
  });

  it("cancels a DRAFT booking without fee fields", async () => {
    const harness = createCommandApp({
      findOwned: vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        status: "DRAFT",
        version: 1,
        snapshotFrozen: false,
        quote: frozenQuote(),
        media: [],
        answers: [],
        statusHistory: [],
        cancelledAt: null,
        emergencySignaled: false,
      }),
    });
    const response = await request(harness.app)
      .post("/api/v1/bookings/booking-1/cancel")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-cancel-draft")
      .send({ version: 1, reason: "CUSTOMER_WRONG_DETAILS" })
      .expect(200);
    expect(response.body.data.status).toBe("CANCELLED");
    expect(JSON.stringify(response.body)).not.toMatch(/fee/i);
  });

  it("rejects cancelled-to-draft HTTP commands and leaves the booking cancelled", async () => {
    const quote = frozenQuote();
    const cancelled = {
      id: "booking-1",
      customerUserId: "user-1",
      countryId: "country-1",
      currencyCode: "EGP",
      currencyDecimalPlaces: 2,
      status: "CANCELLED",
      serviceId: "service-1",
      providerId: "provider-1",
      teamId: "team-1",
      cityId: "city-1",
      districtId: "district-1",
      startsAt: CREATE_BODY.startsAt,
      endsAt: CREATE_BODY.endsAt,
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "AR",
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
      statusHistory: [],
      snapshotFrozen: false,
      cancelledAt: "2026-09-10T09:00:00.000Z",
      submittedAt: null,
      createdAt: "2026-09-10T07:00:00.000Z",
    };
    const harness = createCommandApp({
      findOwned: vi.fn().mockResolvedValue(cancelled),
    });
    const patched = await request(harness.app)
      .patch("/api/v1/bookings/booking-1")
      .set("Authorization", "Bearer verified")
      .send({ version: 1, notes: "restore draft" })
      .expect(409);
    expect(patched.body.error.code).toBe("TRANSITION_NOT_AVAILABLE");
    const submitted = await request(harness.app)
      .post("/api/v1/bookings/booking-1/submit-for-deposit")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-cancelled-submit")
      .send({ version: 1 })
      .expect(409);
    expect(submitted.body.error.code).toBe("TRANSITION_NOT_AVAILABLE");
    const shown = await request(harness.app)
      .get("/api/v1/bookings/booking-1")
      .set("Authorization", "Bearer verified")
      .expect(200);
    expect(shown.body.data.status).toBe("CANCELLED");
  });

  it("rejects submit when the selected team is no longer eligible", async () => {
    const quote = frozenQuote();
    const harness = createCommandApp({
      eligible: false,
      findOwned: vi.fn().mockResolvedValue({
        id: "booking-1",
        customerUserId: "user-1",
        countryId: "country-1",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        status: "DRAFT",
        serviceId: "service-1",
        providerId: "provider-1",
        teamId: "team-1",
        cityId: "city-1",
        districtId: "district-1",
        startsAt: CREATE_BODY.startsAt,
        endsAt: CREATE_BODY.endsAt,
        crewPreference: "any",
        requiredTeamUnits: 1,
        locale: "AR",
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
        statusHistory: [],
        snapshotFrozen: false,
        cancelledAt: null,
        submittedAt: null,
        createdAt: "2026-09-10T07:00:00.000Z",
      }),
    });
    const response = await request(harness.app)
      .post("/api/v1/bookings/booking-1/submit-for-deposit")
      .set("Authorization", "Bearer verified")
      .set("Idempotency-Key", "idem-submit-ineligible")
      .send({ version: 1 })
      .expect(409);
    expect(response.body.error.code).toBe("NOT_ELIGIBLE");
  });
});
