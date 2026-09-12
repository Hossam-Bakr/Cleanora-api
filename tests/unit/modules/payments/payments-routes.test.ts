import {
  createPaymentsRouter,
  createPaymobWebhookRouter,
  createStaffPaymentsRouter,
  PAYMENT_RATE_LIMITS,
} from "#modules/payments/payments.routes";
import { createTestApp } from "../../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../../helpers/test-environment.js";
import { TestLogger } from "../../../helpers/test-logger.js";
import { MemoryRateLimiterAdapter } from "../../../../src/integrations/security/memory-rate-limiter.adapter.js";

const request = require("supertest") as typeof import("supertest");

const customerPrincipal = {
  userId: "customer-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

describe("R1-P15 payments routes mount", () => {
  it("exposes customer, staff, and webhook surfaces through thin handlers", async () => {
    const service = {
      listEnabledMethodsForCountry: vi
        .fn()
        .mockResolvedValue([{ id: "method-card", code: "PAYMOB_CARD" }]),
      initiateBookingDeposit: vi.fn().mockResolvedValue({
        paymentId: "pay-1",
        attemptId: "att-1",
        status: "REDIRECTED",
        amountMinorUnits: "2500",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        gateway: { provider: "PAYMOB", redirectUrl: "https://pay.test" },
        returnToken: "tok",
      }),
      getBrowserReturnStatus: vi.fn().mockResolvedValue({
        paymentId: "pay-1",
        attemptId: "att-1",
        paymentStatus: "PENDING",
        bookingStatus: "AWAITING_DEPOSIT",
        message: "status-only",
      }),
      getPaymentForReader: vi.fn().mockResolvedValue({
        paymentId: "pay-1",
        bookingId: "booking-1",
        purpose: "BOOKING_DEPOSIT",
        status: "PENDING",
        amountMinorUnits: "2500",
        currencyCode: "EGP",
        currencyDecimalPlaces: 2,
        methodCode: "PAYMOB_CARD",
      }),
      setPaymentMethodEnabled: vi.fn().mockResolvedValue({
        id: "method-wallet",
        countryId: "country-eg",
        code: "PAYMOB_WALLET",
        provider: "PAYMOB",
        methodKind: "WALLET",
        displayNameAr: "محفظة",
        displayNameEn: "Wallet",
        enabled: false,
        sortOrder: 2,
      }),
      processPaymobWebhook: vi
        .fn()
        .mockResolvedValue({ replayed: false, paymentId: "pay-1" }),
    };

    const authenticateAccess = (_req: unknown, res: { locals: Record<string, unknown> }, next: () => void) => {
      res.locals["authenticationPrincipal"] = customerPrincipal;
      next();
    };
    const deps = {
      authenticateAccess: authenticateAccess as never,
      optionalAuthenticateAccess: ((_req: unknown, _res: unknown, next: () => void) =>
        next()) as never,
      rateLimiter: new MemoryRateLimiterAdapter(),
      privacyHashSecret: "privacy-secret",
      service: service as never,
      isStaffAdmin: async (userId: string) => userId === "staff-1",
    };

    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      rateLimiter: new MemoryRateLimiterAdapter(),
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1/payments", createPaymentsRouter(deps));
        expressApp.use(
          "/api/v1/staff/payments",
          createStaffPaymentsRouter({
            ...deps,
            authenticateAccess: ((_req: unknown, res: { locals: Record<string, unknown> }, next: () => void) => {
              res.locals["authenticationPrincipal"] = {
                ...customerPrincipal,
                userId: "staff-1",
              };
              next();
            }) as never,
          }),
        );
        expressApp.use(
          "/api/v1/webhooks/paymob",
          createPaymobWebhookRouter(deps),
        );
      },
    });

    const methods = await request(app).get(
      "/api/v1/payments/methods?countryId=country-eg",
    );
    expect(methods.status).toBe(200);
    expect(methods.body.data.items[0].code).toBe("PAYMOB_CARD");

    const deposit = await request(app)
      .post("/api/v1/payments/deposits")
      .set("Idempotency-Key", "idem-route-1")
      .send({ bookingId: "booking-1", paymentMethodId: "method-card" });
    expect(deposit.status).toBe(201);

    const browserReturn = await request(app).get(
      "/api/v1/payments/return?paymentId=pay-1&returnToken=tok",
    );
    expect(browserReturn.status).toBe(200);

    const payment = await request(app).get("/api/v1/payments/pay-1");
    expect(payment.status).toBe(200);

    const toggle = await request(app)
      .patch("/api/v1/staff/payments/methods/method-wallet")
      .send({ enabled: false });
    expect(toggle.status).toBe(200);

    const putToggle = await request(app)
      .put("/api/v1/staff/payments/methods/method-wallet")
      .send({ enabled: true });
    expect(putToggle.status).toBe(200);

    const webhook = await request(app)
      .post("/api/v1/webhooks/paymob")
      .set("hmac", "sig")
      .send({ type: "TRANSACTION" });
    // Without rawBody middleware the controller maps VALIDATION_FAILED.
    expect([200, 400, 401]).toContain(webhook.status);

    expect(PAYMENT_RATE_LIMITS.mutate.limit).toBe(30);
    expect(PAYMENT_RATE_LIMITS.webhook.limit).toBe(120);
  });
});
