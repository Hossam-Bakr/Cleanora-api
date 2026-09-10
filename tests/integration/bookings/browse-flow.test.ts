import type { Express } from "express";
import request from "supertest";

import { createOptionalAuthenticateAccess } from "#modules/authentication/auth.middleware";
import { authenticationError } from "#modules/authentication/domain/authentication.errors";
import { createBookingsBrowseRouter } from "#modules/bookings/bookings.routes";
import { BookingsBrowseService } from "#modules/bookings/bookings.service";
import { ProviderBrowseProjectionService } from "#modules/providers/provider-browse-projection.service";
import { createErrorMiddleware } from "#middlewares/error.middleware";
import { requestIdMiddleware } from "#middlewares/request-id.middleware";
import type { Logger } from "#shared/logger";

const express = require("express") as typeof import("express");

const BROWSE_QUERY =
  "serviceId=s1&countryId=country-eg&cityId=city-cairo" +
  "&startsAt=2026-09-10T08%3A00%3A00.000Z" +
  "&endsAt=2026-09-10T12%3A00%3A00.000Z" +
  "&crewPreference=any&requiredTeamUnits=1&locale=EN";

const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child() {
    return this;
  },
};

function sortingFacts(priceAmount: string) {
  return {
    priceAmount,
    minimumChargeAmount: "50.00",
    currencyCode: "EGP",
    priceUnitId: "unit-hour",
    estimatedDurationMinutes: 60,
    matchingCapacityUnits: 1,
  };
}

function createBrowseHarness(options: { readonly rateAllowed?: boolean } = {}): {
  readonly app: Express;
  readonly getStandardBrowseCandidates: ReturnType<typeof vi.fn>;
  readonly rateConsume: ReturnType<typeof vi.fn>;
} {
  const getStandardBrowseCandidates = vi.fn().mockResolvedValue({
    candidates: [
      { providerId: "provider-1", teamId: "team-1", sortingFacts: sortingFacts("80.00") },
      { providerId: "provider-2", teamId: "team-2", sortingFacts: sortingFacts("120.00") },
    ],
    metadata: {
      resultHash: "result-hash-includes-first-evaluated-at",
      ruleVersionId: "r1-v1",
      evaluatedAt: "2026-09-10T00:00:00.000Z",
    },
  });
  const providerProjection = new ProviderBrowseProjectionService({
    providers: {
      findById: vi.fn(async (providerId: string) => ({
        id: providerId,
        kind: "INDIVIDUAL_TEAM",
        operationalEmail: "private@example.test",
        operationalPhone: "+201000000000",
      })),
      getProfile: vi.fn(async (providerId: string) => ({
        displayNameAr: providerId === "provider-1" ? "الفريق الأول" : "الفريق الثاني",
        displayNameEn: providerId === "provider-1" ? "Alpha Clean" : "Beta Clean",
        descriptionAr: null,
        descriptionEn: "Public description",
        countryId: "country-eg",
        applicantContext: "private-applicant-context",
      })),
    } as never,
    activeCountries: {
      getById: vi.fn().mockResolvedValue({ id: "country-eg", code: "EG" }),
    },
    mediaUsage: {
      getUsageSnapshot: vi.fn().mockResolvedValue({
        logoMediaFileId: null,
        coverMediaFileId: null,
        gallery: [],
        logoStatus: "EMPTY",
        coverStatus: "EMPTY",
        imageCount: 0,
        videoCount: 0,
        readyGalleryImageCount: 0,
      }),
    },
    mediaReader: { getMediaStatus: vi.fn() },
    media: {
      createSignedDeliveryUrl: vi.fn(),
      createSignedThumbnailUrl: vi.fn(),
    },
    signedUrlTtlSeconds: 300,
  });
  const service = new BookingsBrowseService({
    eligibility: { getStandardBrowseCandidates },
    catalog: {
      listSelectable: vi.fn().mockResolvedValue({
        items: [{ serviceId: "s1", serviceCode: "HOME_CLEANING", name: "Home cleaning" }],
        nextCursor: null,
      }),
      getSnapshotReadyDefinitionById: vi.fn().mockResolvedValue({
        serviceId: "s1",
        serviceCode: "HOME_CLEANING",
        name: "Home cleaning",
      }),
    } as never,
    locality: {
      listActiveCitiesForCountry: vi.fn().mockResolvedValue([
        { cityId: "city-cairo", code: "CAI", nameAr: "القاهرة", nameEn: "Cairo" },
      ]),
      listActiveDistrictsForCity: vi.fn().mockResolvedValue([
        {
          districtId: "district-maadi",
          cityId: "city-cairo",
          code: "MAADI",
          nameAr: "المعادي",
          nameEn: "Maadi",
        },
      ]),
    },
    providers: {
      getContactFreePreview: (providerId, previewOptions) =>
        providerProjection.getContactFreePreview(providerId, previewOptions),
      getBookingSafeTeamFacts: vi.fn(async ({ providerId, teamId }) => ({
        providerId,
        teamId,
        teamVersion: 3,
        active: true,
        members: [
          {
            workerId: "worker-private-id",
            gender: "female" as const,
            workerType: "CLEANING_STAFF" as const,
            cleans: true,
          },
        ],
      })),
    },
    activeCountries: {
      resolveActiveCountry: vi.fn().mockResolvedValue({ id: "country-eg", code: "EG" }),
      getActiveCountryById: vi.fn().mockResolvedValue({ id: "country-eg", code: "EG" }),
    },
    cursorSecret: "integration-browse-cursor-secret-32chars!!",
  });
  const rateConsume = vi.fn().mockResolvedValue(
    options.rateAllowed === false
      ? { allowed: false, remaining: 0, retryAfterSeconds: 60 }
      : { allowed: true, remaining: 59 },
  );
  const optionalAuthenticateAccess = createOptionalAuthenticateAccess({
    authenticateAccess: vi.fn(async (token: string) => {
      if (token !== "valid-access-token") {
        throw authenticationError("AUTHENTICATION_REQUIRED");
      }
      return { userId: "customer-1" } as never;
    }),
  });
  const router = createBookingsBrowseRouter({
    optionalAuthenticateAccess,
    rateLimiter: { consume: rateConsume },
    privacyHashSecret: "integration-browse-privacy-secret-32chars!",
    service,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use("/api/v1/browse", router);
  app.use(createErrorMiddleware(logger));
  return { app, getStandardBrowseCandidates, rateConsume };
}

describe("R1-P12 guest Browse HTTP integration", () => {
  it("completes catalog to paginated eligible list to contact-free detail", async () => {
    const harness = createBrowseHarness();

    const services = await request(harness.app)
      .get("/api/v1/browse/services?countryCode=EG&locale=EN")
      .expect(200);
    expect(services.body).toMatchObject({ success: true, data: { items: [{ serviceId: "s1" }] } });

    const cities = await request(harness.app)
      .get("/api/v1/browse/countries/EG/cities")
      .expect(200);
    expect(cities.body.data.items[0]).toMatchObject({ cityId: "city-cairo" });

    const firstPage = await request(harness.app)
      .get(`/api/v1/browse/providers?${BROWSE_QUERY}&limit=1`)
      .expect(200);
    expect(firstPage.body.data.items.map((item: { providerId: string }) => item.providerId)).toEqual([
      "provider-1",
    ]);
    expect(firstPage.body.data.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(harness.app)
      .get(
        `/api/v1/browse/providers?${BROWSE_QUERY}&limit=1&cursor=${encodeURIComponent(firstPage.body.data.nextCursor as string)}`,
      )
      .expect(200);
    expect(secondPage.body.data.items.map((item: { providerId: string }) => item.providerId)).toEqual([
      "provider-2",
    ]);
    expect(harness.getStandardBrowseCandidates).toHaveBeenCalledTimes(1);

    const detail = await request(harness.app)
      .get(`/api/v1/browse/providers/provider-1/teams/team-1?${BROWSE_QUERY}`)
      .expect(200);
    expect(detail.body.data).toMatchObject({
      providerId: "provider-1",
      teamId: "team-1",
      ratingSummary: null,
      bookingPrerequisites: { bookingAvailable: false, requiresVerifiedCustomer: true },
      sideEffects: { bookingCreated: false, paymentInitiated: false },
      servicePrice: { status: "AVAILABLE", priceAmount: "80.00" },
      crewSummary: { cleanerCount: 1, genderCounts: { female: 1 } },
    });
    const serialized = JSON.stringify(detail.body);
    for (const forbidden of [
      "private@example.test",
      "+201000000000",
      "worker-private-id",
      "private-applicant-context",
      "storageKey",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("rejects invalid auth, forbidden geo input, and rate-limit abuse", async () => {
    const harness = createBrowseHarness();
    const invalidAuth = await request(harness.app)
      .get("/api/v1/browse/services?countryCode=EG&locale=EN")
      .set("Authorization", "Token invalid")
      .expect(401);
    expect(invalidAuth.body.error.code).toBe("AUTHENTICATION_REQUIRED");

    const invalidGeo = await request(harness.app)
      .get(`/api/v1/browse/providers?${BROWSE_QUERY}&lat=30.0`)
      .expect(400);
    expect(invalidGeo.body.error.code).toBe("VALIDATION_FAILED");

    const limited = createBrowseHarness({ rateAllowed: false });
    const throttled = await request(limited.app)
      .get(`/api/v1/browse/providers?${BROWSE_QUERY}`)
      .expect(429);
    expect(throttled.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(throttled.headers["retry-after"]).toBe("60");
  });
});
