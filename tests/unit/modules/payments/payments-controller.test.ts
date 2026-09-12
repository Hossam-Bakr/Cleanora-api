import { createPaymentsController } from "#modules/payments/payments.controller";
import { paymentsError } from "#modules/payments/payments.errors";
import type { Request, Response } from "express";

const customerPrincipal = {
  userId: "customer-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE" as const,
  verificationOnly: false,
};

function request(overrides: Record<string, unknown> = {}): Request {
  const headers = new Map<string, string>();
  const get = (name: string) => headers.get(name.toLowerCase());
  const base = {
    body: {},
    query: {},
    params: {},
    protocol: "https",
    originalUrl: "/api/v1/payments",
    requestId: "11111111-1111-4111-8111-111111111111",
    get,
    ...overrides,
  };
  if (overrides["idempotencyKey"] !== undefined) {
    headers.set("idempotency-key", String(overrides["idempotencyKey"]));
  }
  if (overrides["hmac"] !== undefined) {
    headers.set("hmac", String(overrides["hmac"]));
  }
  return base as unknown as Request;
}

function response(principal?: unknown) {
  const result = {
    locals:
      principal === undefined
        ? {}
        : { authenticationPrincipal: principal },
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
  return result as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

describe("R1-P15 payments controller", () => {
  it("lists methods for a verified customer", async () => {
    const listEnabledMethodsForCountry = vi
      .fn()
      .mockResolvedValue([{ id: "method-card", code: "PAYMOB_CARD" }]);
    const controller = createPaymentsController({
      service: { listEnabledMethodsForCountry } as never,
      isStaffAdmin: async () => false,
    });
    const res = response(customerPrincipal);
    await controller.listMethods(
      request({ query: { countryId: "country-eg" } }),
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(200);
    expect(listEnabledMethodsForCountry).toHaveBeenCalledWith({
      countryId: "country-eg",
    });
  });

  it("rejects listMethods without a verified customer principal", async () => {
    const next = vi.fn();
    const controller = createPaymentsController({
      service: { listEnabledMethodsForCountry: vi.fn() } as never,
      isStaffAdmin: async () => false,
    });
    await controller.listMethods(
      request({ query: { countryId: "country-eg" } }),
      response(),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });

    await controller.listMethods(
      request({ query: { countryId: "country-eg" } }),
      response({ ...customerPrincipal, verificationOnly: true }),
      next,
    );
    expect(next.mock.calls[1]?.[0]).toMatchObject({ code: "FORBIDDEN" });
  });

  it("initiates deposit with Idempotency-Key and maps payments errors", async () => {
    const initiateBookingDeposit = vi.fn().mockResolvedValue({
      paymentId: "pay-1",
      attemptId: "att-1",
      status: "REDIRECTED",
    });
    const controller = createPaymentsController({
      service: { initiateBookingDeposit } as never,
      isStaffAdmin: async () => false,
    });
    const res = response(customerPrincipal);
    await controller.initiateDeposit(
      request({
        body: { bookingId: "booking-1", paymentMethodId: "method-card" },
        idempotencyKey: "idem-1",
      }),
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(201);
    expect(initiateBookingDeposit).toHaveBeenCalledWith({
      actorUserId: "customer-1",
      bookingId: "booking-1",
      paymentMethodId: "method-card",
      idempotencyKey: "idem-1",
    });

    const next = vi.fn();
    await controller.initiateDeposit(
      request({
        body: { bookingId: "booking-1", paymentMethodId: "method-card" },
      }),
      response(customerPrincipal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("projects browser return without requiring principal", async () => {
    const getBrowserReturnStatus = vi.fn().mockResolvedValue({
      paymentId: "pay-1",
      paymentStatus: "PENDING",
    });
    const controller = createPaymentsController({
      service: { getBrowserReturnStatus } as never,
      isStaffAdmin: async () => false,
    });
    const res = response();
    await controller.browserReturn(
      request({
        query: {
          paymentId: "pay-1",
          attemptId: "att-1",
          returnToken: "tok",
        },
      }),
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(200);
    expect(getBrowserReturnStatus).toHaveBeenCalledWith({
      paymentId: "pay-1",
      attemptId: "att-1",
      returnToken: "tok",
    });
  });

  it("reads payment as staff_admin or customer", async () => {
    const getPaymentForReader = vi.fn().mockResolvedValue({
      paymentId: "pay-1",
      status: "SUCCEEDED",
    });
    const controller = createPaymentsController({
      service: { getPaymentForReader } as never,
      isStaffAdmin: async (userId) => userId === "staff-1",
    });
    await controller.getPayment(
      request({ params: { paymentId: "pay-1" } }),
      response({ ...customerPrincipal, userId: "staff-1" }),
      vi.fn(),
    );
    expect(getPaymentForReader).toHaveBeenCalledWith({
      paymentId: "pay-1",
      reader: { kind: "STAFF_ADMIN", userId: "staff-1" },
    });

    await controller.getPayment(
      request({ params: { paymentId: "pay-1" } }),
      response(customerPrincipal),
      vi.fn(),
    );
    expect(getPaymentForReader).toHaveBeenLastCalledWith({
      paymentId: "pay-1",
      reader: { kind: "CUSTOMER", userId: "customer-1" },
    });
  });

  it("toggles method only for staff_admin", async () => {
    const setPaymentMethodEnabled = vi.fn().mockResolvedValue({
      id: "method-wallet",
      enabled: false,
    });
    const controller = createPaymentsController({
      service: { setPaymentMethodEnabled } as never,
      isStaffAdmin: async (userId) => userId === "staff-1",
    });
    const res = response({ ...customerPrincipal, userId: "staff-1" });
    await controller.setMethodEnabled(
      request({
        params: { methodId: "method-wallet" },
        body: { enabled: false },
      }),
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(200);
    expect(setPaymentMethodEnabled).toHaveBeenCalledWith({
      staffUserId: "staff-1",
      methodId: "method-wallet",
      enabled: false,
    });

    const next = vi.fn();
    await controller.setMethodEnabled(
      request({
        params: { methodId: "method-wallet" },
        body: { enabled: false },
      }),
      response(customerPrincipal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "FORBIDDEN" });
  });

  it("forwards Paymob webhook raw body and signature headers", async () => {
    const processPaymobWebhook = vi
      .fn()
      .mockResolvedValue({ replayed: false, paymentId: "pay-1" });
    const controller = createPaymentsController({
      service: { processPaymobWebhook } as never,
      isStaffAdmin: async () => false,
    });
    const rawBody = Buffer.from('{"ok":true}');
    const res = response();
    await controller.paymobWebhook(
      request({ rawBody, hmac: "sig-1" }),
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(200);
    expect(processPaymobWebhook).toHaveBeenCalledWith({
      rawBody,
      signatureHeader: "sig-1",
    });

    const next = vi.fn();
    await controller.paymobWebhook(request(), response(), next);
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("maps ZodError and unexpected errors through next", async () => {
    const controller = createPaymentsController({
      service: {
        listEnabledMethodsForCountry: vi.fn().mockRejectedValue(
          paymentsError("NOT_FOUND"),
        ),
      } as never,
      isStaffAdmin: async () => false,
    });
    const next = vi.fn();
    await controller.listMethods(
      request({ query: { countryId: "country-eg" } }),
      response(customerPrincipal),
      next,
    );
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: "NOT_FOUND" });

    await controller.listMethods(
      request({ query: {} }),
      response(customerPrincipal),
      next,
    );
    expect(next.mock.calls[1]?.[0]).toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});
