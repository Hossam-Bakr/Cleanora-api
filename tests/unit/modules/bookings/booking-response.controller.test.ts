import { createBookingResponseController } from "#modules/bookings/bookings.response.controller";
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
  userId: "owner-1",
  sessionId: "s1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

describe("R1-P16 booking response HTTP adapters", () => {
  it("uses the default inbox limit when the query omits it", async () => {
    const listInbox = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const controller = createBookingResponseController({
      service: { listInbox } as never,
    });
    const response = mockResponse(principal);
    await controller.inbox(
      {
        params: { providerId: "prov-1" },
        query: {},
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(listInbox).toHaveBeenCalledWith({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 20,
    });
  });

  it("lists inbox items for the authenticated manager", async () => {
    const listInbox = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const controller = createBookingResponseController({
      service: { listInbox } as never,
    });
    const response = mockResponse(principal);
    await controller.inbox(
      {
        params: { providerId: "prov-1" },
        query: { limit: "20" },
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(200);
    expect(listInbox).toHaveBeenCalledWith({
      actorUserId: "owner-1",
      providerId: "prov-1",
      limit: 20,
    });
  });

  it("requires Idempotency-Key on accept", async () => {
    const controller = createBookingResponseController({
      service: { accept: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.accept(
      {
        params: { providerId: "prov-1", bookingId: "bk-1" },
        body: { version: 4 },
        get: () => undefined,
      } as unknown as Request,
      mockResponse(principal),
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("accepts with version and idempotency key", async () => {
    const accept = vi.fn().mockResolvedValue({
      bookingId: "bk-1",
      status: "ACCEPTED",
      version: 5,
      responseStatus: "ACCEPTED",
    });
    const controller = createBookingResponseController({
      service: { accept } as never,
    });
    const response = mockResponse(principal);
    await controller.accept(
      {
        params: { providerId: "prov-1", bookingId: "bk-1" },
        body: { version: 4 },
        get: (name: string) =>
          name.toLowerCase() === "idempotency-key" ? "idem-1" : undefined,
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(200);
    expect(accept).toHaveBeenCalledWith({
      actorUserId: "owner-1",
      providerId: "prov-1",
      bookingId: "bk-1",
      version: 4,
      idempotencyKey: "idem-1",
    });
  });

  it("rejects with a reason code and does not invent a fee field", async () => {
    const reject = vi.fn().mockResolvedValue({
      bookingId: "bk-1",
      status: "CANCELLED",
      version: 5,
      responseStatus: "REJECTED",
      cancellationId: "can-1",
    });
    const controller = createBookingResponseController({
      service: { reject } as never,
    });
    const response = mockResponse(principal);
    await controller.reject(
      {
        params: { providerId: "prov-1", bookingId: "bk-1" },
        body: { version: 4, reasonCode: "PROVIDER_CANNOT_FULFILL" },
        get: (name: string) =>
          name.toLowerCase() === "idempotency-key" ? "idem-rej" : undefined,
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/fee/i);
    expect(reject).toHaveBeenCalled();
  });

  it("cancels as the selected provider", async () => {
    const providerCancel = vi.fn().mockResolvedValue({
      bookingId: "bk-1",
      status: "CANCELLED",
      version: 5,
      cancellationId: "can-1",
    });
    const controller = createBookingResponseController({
      service: { providerCancel } as never,
    });
    const response = mockResponse(principal);
    await controller.providerCancel(
      {
        params: { providerId: "prov-1", bookingId: "bk-1" },
        body: { version: 4, reasonCode: "PROVIDER_UNABLE_TO_CONTINUE" },
        get: (name: string) =>
          name.toLowerCase() === "idempotency-key" ? "idem-pc" : undefined,
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(200);
  });

  it("lists cancellation reasons", async () => {
    const listReasons = vi.fn().mockResolvedValue([
      { code: "CUSTOMER_CHANGED_MIND", labelAr: "رأي", labelEn: "Mind" },
    ]);
    const controller = createBookingResponseController({
      service: { listReasons } as never,
    });
    const response = mockResponse(principal);
    await controller.reasons(
      {
        query: { actor: "CUSTOMER", purpose: "CANCEL" },
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(200);
    expect(listReasons).toHaveBeenCalledWith({
      actor: "CUSTOMER",
      purpose: "CANCEL",
    });
  });

  it("reads provider and staff dossiers", async () => {
    const getProviderDossier = vi.fn().mockResolvedValue({ bookingId: "bk-1" });
    const getStaffDossier = vi.fn().mockResolvedValue({ bookingId: "bk-1" });
    const staffCancel = vi.fn().mockResolvedValue({
      bookingId: "bk-1",
      status: "CANCELLED",
    });
    const controller = createBookingResponseController({
      service: { getProviderDossier, getStaffDossier, staffCancel } as never,
    });
    const response = mockResponse(principal);
    await controller.providerGet(
      {
        params: { providerId: "prov-1", bookingId: "bk-1" },
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      response,
      vi.fn(),
    );
    expect(getProviderDossier).toHaveBeenCalled();
    await controller.staffGet(
      {
        params: { bookingId: "bk-1" },
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    expect(getStaffDossier).toHaveBeenCalled();
    await controller.staffCancel(
      {
        params: { bookingId: "bk-1" },
        body: { version: 4, reasonCode: "STAFF_OPS_CANCEL" },
        get: (name: string) =>
          name.toLowerCase() === "idempotency-key" ? "idem-st" : undefined,
        requestId: "11111111-1111-4111-8111-111111111111",
      } as unknown as Request,
      mockResponse(principal),
      vi.fn(),
    );
    expect(staffCancel).toHaveBeenCalled();
  });

  it("maps a missing principal to AUTHENTICATION_REQUIRED", async () => {
    const controller = createBookingResponseController({
      service: { listInbox: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.inbox(
      {
        params: { providerId: "prov-1" },
        query: {},
      } as unknown as Request,
      mockResponse(),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("maps invalid accept bodies to VALIDATION_FAILED", async () => {
    const controller = createBookingResponseController({
      service: { accept: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.accept(
      {
        params: { providerId: "prov-1", bookingId: "bk-1" },
        body: { version: "nope" },
        get: (name: string) =>
          name.toLowerCase() === "idempotency-key" ? "idem-1" : undefined,
      } as unknown as Request,
      mockResponse(principal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("maps invalid staff params to VALIDATION_FAILED", async () => {
    const controller = createBookingResponseController({
      service: { getStaffDossier: vi.fn(), staffCancel: vi.fn() } as never,
    });
    const next = vi.fn();
    await controller.staffGet(
      {
        params: {},
      } as unknown as Request,
      mockResponse(principal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
