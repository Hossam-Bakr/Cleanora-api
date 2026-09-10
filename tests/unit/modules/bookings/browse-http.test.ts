import type { Request, Response } from "express";

import { createBookingsBrowseController } from "#modules/bookings/bookings.controller";
import { createBookingsBrowseRouter } from "#modules/bookings/bookings.routes";
import {
  browseProvidersQuerySchema,
  browseServicesQuerySchema,
} from "#modules/bookings/bookings.schema";

function mockResponse() {
  const response = {
    locals: {},
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return response as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe("browse schemas", () => {
  it("rejects geographic extras", () => {
    const parsed = browseProvidersQuerySchema.safeParse({
      serviceId: "s1",
      countryId: "c1",
      cityId: "city1",
      startsAt: "2026-09-10T08:00:00.000Z",
      endsAt: "2026-09-10T12:00:00.000Z",
      crewPreference: "any",
      requiredTeamUnits: 1,
      locale: "AR",
      lat: "30.0",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid services query", () => {
    const parsed = browseServicesQuerySchema.parse({
      countryCode: "eg",
      locale: "EN",
    });
    expect(parsed.countryCode).toBe("EG");
    expect(parsed.limit).toBe(20);
  });
});

describe("browse controller and routes", () => {
  it("lists services for guests", async () => {
    const listServices = vi.fn().mockResolvedValue({
      items: [{ serviceId: "s1" }],
      nextCursor: null,
    });
    const controller = createBookingsBrowseController({
      service: {
        listServices,
        getService: vi.fn(),
        listCities: vi.fn(),
        listDistricts: vi.fn(),
        listEligibleProviders: vi.fn(),
        getEligibleProviderDetail: vi.fn(),
        getProviderPreview: vi.fn(),
        getCrewSummary: vi.fn(),
      },
    });
    const response = mockResponse();
    const next = vi.fn();
    await controller.listServices(
      {
        query: { countryCode: "EG", locale: "AR" },
        requestId: "req-1",
      } as unknown as Request,
      response,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(listServices).toHaveBeenCalledWith({
      countryCode: "EG",
      locale: "AR",
      limit: 20,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { items: [{ serviceId: "s1" }] },
    });
  });

  it("returns provider detail payloads with EX-02 sideEffects", async () => {
    const getEligibleProviderDetail = vi.fn().mockResolvedValue({
      providerId: "p1",
      teamId: "t1",
      sideEffects: { bookingCreated: false, paymentInitiated: false },
      bookingPrerequisites: {
        bookingAvailable: false,
        requiresVerifiedCustomer: true,
        phase: "R1-P13+",
      },
      ratingSummary: null,
    });
    const controller = createBookingsBrowseController({
      service: {
        listServices: vi.fn(),
        getService: vi.fn(),
        listCities: vi.fn(),
        listDistricts: vi.fn(),
        listEligibleProviders: vi.fn(),
        getEligibleProviderDetail,
        getProviderPreview: vi.fn(),
        getCrewSummary: vi.fn(),
      },
    });
    const response = mockResponse();
    await controller.getProviderDetail(
      {
        params: { providerId: "p1", teamId: "t1" },
        query: {
          serviceId: "s1",
          countryId: "c1",
          cityId: "city1",
          startsAt: "2026-09-10T08:00:00.000Z",
          endsAt: "2026-09-10T12:00:00.000Z",
          crewPreference: "any",
          requiredTeamUnits: "1",
          locale: "EN",
        },
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        sideEffects: { bookingCreated: false, paymentInitiated: false },
      },
    });
  });

  it("covers remaining browse HTTP handlers", async () => {
    const service = {
      listServices: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getService: vi.fn().mockResolvedValue({ serviceId: "s1" }),
      listCities: vi.fn().mockResolvedValue([{ cityId: "c1" }]),
      listDistricts: vi.fn().mockResolvedValue([{ districtId: "d1" }]),
      listEligibleProviders: vi.fn().mockResolvedValue({
        items: [],
        nextCursor: null,
        metadata: {
          resultHash: "h",
          ruleVersionId: "r",
          evaluatedAt: "2026-09-10T00:00:00.000Z",
        },
        sideEffects: { bookingCreated: false, paymentInitiated: false },
      }),
      getEligibleProviderDetail: vi.fn(),
      getProviderPreview: vi.fn(),
      getCrewSummary: vi.fn(),
    };
    const controller = createBookingsBrowseController({ service });
    const next = vi.fn();

    await controller.getService(
      {
        params: { serviceId: "s1" },
        query: { countryCode: "EG", locale: "AR" },
      } as unknown as Request,
      mockResponse(),
      next,
    );
    await controller.listCities(
      { params: { countryCode: "EG" } } as unknown as Request,
      mockResponse(),
      next,
    );
    await controller.listDistricts(
      {
        params: { countryCode: "EG", cityId: "city1" },
      } as unknown as Request,
      mockResponse(),
      next,
    );
    await controller.listProviders(
      {
        query: {
          serviceId: "s1",
          countryId: "c1",
          cityId: "city1",
          startsAt: "2026-09-10T08:00:00.000Z",
          endsAt: "2026-09-10T12:00:00.000Z",
          crewPreference: "any",
          requiredTeamUnits: "1",
          locale: "EN",
        },
      } as unknown as Request,
      mockResponse(),
      next,
    );

    expect(service.getService).toHaveBeenCalled();
    expect(service.listCities).toHaveBeenCalledWith("EG");
    expect(service.listDistricts).toHaveBeenCalledWith({
      countryCode: "EG",
      cityId: "city1",
    });
    expect(service.listEligibleProviders).toHaveBeenCalled();
  });

  it("mounts browse routes behind optional auth and exercises handlers", async () => {
    const optionalAuthenticateAccess = vi.fn((_req, _res, next) => next());
    const router = createBookingsBrowseRouter({
      optionalAuthenticateAccess,
      rateLimiter: {
        consume: vi.fn().mockResolvedValue({ allowed: true, remaining: 59 }),
      },
      privacyHashSecret: "unit-test-browse-privacy-secret-32chars",
      service: {
        listServices: vi.fn(),
        getService: vi.fn(),
        listCities: vi.fn(),
        listDistricts: vi.fn(),
        listEligibleProviders: vi.fn(),
        getEligibleProviderDetail: vi.fn(),
        getProviderPreview: vi.fn(),
        getCrewSummary: vi.fn(),
      },
    });
    const layered = router.stack.map((layer) => ({
      name: layer.name,
      path: layer.route?.path,
      methods: layer.route
        ? Object.keys(
            (layer.route as unknown as { methods: Record<string, unknown> })
              .methods,
          )
        : [],
    }));
    expect(layered.some((layer) => layer.path === "/services")).toBe(true);
    expect(layered.some((layer) => layer.path === "/services/:serviceId")).toBe(
      true,
    );
    expect(
      layered.some((layer) => layer.path === "/countries/:countryCode/cities"),
    ).toBe(true);
    expect(
      layered.some(
        (layer) =>
          layer.path ===
          "/countries/:countryCode/cities/:cityId/districts",
      ),
    ).toBe(true);
    expect(layered.some((layer) => layer.path === "/providers")).toBe(true);
    expect(
      layered.some((layer) => layer.path === "/providers/:providerId/teams/:teamId"),
    ).toBe(true);

    for (const layer of router.stack) {
      if (layer.route === undefined) {
        continue;
      }
      const handlers = layer.route.stack.map((entry) => entry.handle);
      for (const handler of handlers) {
        const response = mockResponse();
        await Promise.resolve(
          handler(
            {
              params: {
                serviceId: "s1",
                countryCode: "EG",
                cityId: "city1",
                providerId: "p1",
                teamId: "t1",
              },
              query: {
                countryCode: "EG",
                locale: "AR",
                serviceId: "s1",
                countryId: "c1",
                cityId: "city1",
                startsAt: "2026-09-10T08:00:00.000Z",
                endsAt: "2026-09-10T12:00:00.000Z",
                crewPreference: "any",
                requiredTeamUnits: "1",
              },
              requestId: "req-route",
            } as unknown as Request,
            response,
            vi.fn(),
          ),
        );
      }
    }
  });
});
