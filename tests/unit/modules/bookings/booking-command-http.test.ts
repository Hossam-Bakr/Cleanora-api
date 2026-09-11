import { createBookingsCommandController } from "#modules/bookings/bookings.command.controller";
import { createBookingsCommandRouter } from "#modules/bookings/bookings.command.routes";
import type { Request, Response } from "express";

function mockResponse(principal?: unknown) {
  const response = {
    locals: principal === undefined ? {} : { authenticationPrincipal: principal },
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

const principal = {
  userId: "user-1",
  sessionId: "s1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

describe("booking command HTTP", () => {
  it("creates a draft with Idempotency-Key", async () => {
    const createDraft = vi.fn().mockResolvedValue({ id: "booking-1", status: "DRAFT" });
    const controller = createBookingsCommandController({
      service: {
        createDraft,
        list: vi.fn(),
        get: vi.fn(),
        patchDraft: vi.fn(),
        submitForDeposit: vi.fn(),
        cancel: vi.fn(),
        attachMedia: vi.fn(),
      } as never,
    });
    const response = mockResponse(principal);
    await controller.create(
      {
        body: {
          serviceId: "service-1",
          providerId: "provider-1",
          teamId: "team-1",
          countryId: "country-1",
          cityId: "city-1",
          startsAt: "2026-09-10T08:00:00.000Z",
          endsAt: "2026-09-10T12:00:00.000Z",
          crewPreference: "any",
          requiredTeamUnits: 1,
          locale: "AR",
          userAddressId: "addr-1",
        },
        get: (name: string) =>
          name.toLowerCase() === "idempotency-key" ? "idem-1" : undefined,
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(201);
    expect(createDraft).toHaveBeenCalled();
  });

  it("maps missing Idempotency-Key to VALIDATION_FAILED", async () => {
    const controller = createBookingsCommandController({
      service: { createDraft: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.create(
      {
        body: {},
        get: () => undefined,
      } as unknown as Request,
      mockResponse(principal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("maps Zod failures to VALIDATION_FAILED", async () => {
    const controller = createBookingsCommandController({
      service: { list: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.list(
      { query: { limit: "nope" } } as unknown as Request,
      mockResponse(principal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("requires a principal", async () => {
    const controller = createBookingsCommandController({
      service: { get: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.get(
      { params: { bookingId: "booking-1" } } as unknown as Request,
      mockResponse(),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("routes remaining command handlers through the service", async () => {
    const service = {
      createDraft: vi.fn(),
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      get: vi.fn().mockResolvedValue({ id: "booking-1" }),
      patchDraft: vi.fn().mockResolvedValue({ id: "booking-1" }),
      submitForDeposit: vi.fn().mockResolvedValue({ id: "booking-1" }),
      cancel: vi.fn().mockResolvedValue({ id: "booking-1" }),
      attachMedia: vi.fn().mockResolvedValue({ id: "booking-1" }),
    };
    const controller = createBookingsCommandController({ service: service as never });
    const header = (name: string) =>
      name.toLowerCase() === "idempotency-key" ? "idem-1" : undefined;
    await controller.list({ query: {} } as unknown as Request, mockResponse(principal), vi.fn());
    await controller.get(
      { params: { bookingId: "booking-1" } } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    await controller.patch(
      {
        params: { bookingId: "booking-1" },
        body: { version: 1, notes: "n" },
        get: header,
      } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    await controller.submitForDeposit(
      {
        params: { bookingId: "booking-1" },
        body: { version: 1 },
        get: header,
      } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    await controller.cancel(
      {
        params: { bookingId: "booking-1" },
        body: { version: 1, reason: "OTHER" },
        get: header,
        requestId: "req-1",
      } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    await controller.attachMedia(
      {
        params: { bookingId: "booking-1" },
        body: { version: 1, mediaId: "media-1" },
        get: header,
      } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    expect(service.list).toHaveBeenCalled();
    expect(service.get).toHaveBeenCalled();
    expect(service.patchDraft).toHaveBeenCalled();
    expect(service.submitForDeposit).toHaveBeenCalled();
    expect(service.cancel).toHaveBeenCalled();
    expect(service.attachMedia).toHaveBeenCalled();
  });

  it("patches drafts without an Idempotency-Key and ignores one if sent", async () => {
    const patchDraft = vi.fn().mockResolvedValue({ id: "booking-1" });
    const controller = createBookingsCommandController({
      service: { patchDraft } as never,
    });
    const response = mockResponse(principal);
    await controller.patch(
      {
        params: { bookingId: "booking-1" },
        body: { version: 1, notes: "n" },
        get: () => undefined,
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(patchDraft).toHaveBeenCalledWith(
      expect.anything(),
      "booking-1",
      expect.objectContaining({ version: 1 }),
    );
    const next = vi.fn();
    await controller.patch(
      {
        params: { bookingId: "booking-1" },
        body: { version: 1 },
        get: () => "",
      } as unknown as Request,
      mockResponse(principal),
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(patchDraft).toHaveBeenCalledTimes(2);
  });

  it("mounts authenticated command routes and exercises handlers", async () => {
    const authenticateAccess = vi.fn((_req, _res, next) => next());
    const service = {
      createDraft: vi.fn().mockResolvedValue({ id: "booking-1" }),
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      get: vi.fn().mockResolvedValue({ id: "booking-1" }),
      patchDraft: vi.fn().mockResolvedValue({ id: "booking-1" }),
      submitForDeposit: vi.fn().mockResolvedValue({ id: "booking-1" }),
      cancel: vi.fn().mockResolvedValue({ id: "booking-1" }),
      attachMedia: vi.fn().mockResolvedValue({ id: "booking-1" }),
    };
    const router = createBookingsCommandRouter({
      authenticateAccess,
      rateLimiter: {
        consume: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
      },
      privacyHashSecret: "secret",
      service: service as never,
    });
    expect(router.stack.length).toBeGreaterThan(3);
    for (const layer of router.stack) {
      if (layer.route === undefined) {
        continue;
      }
      for (const entry of layer.route.stack) {
        const response = mockResponse(principal);
        await Promise.resolve(
          entry.handle(
            {
              params: { bookingId: "booking-1" },
              query: {},
              body: {
                serviceId: "service-1",
                providerId: "provider-1",
                teamId: "team-1",
                countryId: "country-1",
                cityId: "city-1",
                startsAt: "2026-09-10T08:00:00.000Z",
                endsAt: "2026-09-10T12:00:00.000Z",
                crewPreference: "any",
                requiredTeamUnits: 1,
                locale: "AR",
                userAddressId: "addr-1",
                version: 1,
                reason: "OTHER",
                mediaId: "media-1",
              },
              get: (name: string) =>
                name.toLowerCase() === "idempotency-key" ? "idem-1" : undefined,
              ip: undefined,
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
