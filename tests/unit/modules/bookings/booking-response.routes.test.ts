import {
  createBookingProviderResponseRouter,
  createBookingReasonsRouter,
  createBookingStaffResponseRouter,
} from "#modules/bookings/bookings.response.routes";
import { createTestApp } from "../../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../../helpers/test-environment.js";
import { TestLogger } from "../../../helpers/test-logger.js";
import { MemoryRateLimiterAdapter } from "../../../../src/integrations/security/memory-rate-limiter.adapter.js";

const request = require("supertest") as typeof import("supertest");

const principal = {
  userId: "owner-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

describe("R1-P16 booking response routes", () => {
  it("mounts provider, reason, and staff surfaces through thin handlers", async () => {
    const service = {
      listInbox: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getProviderDossier: vi.fn().mockResolvedValue({ bookingId: "bk-1" }),
      accept: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "ACCEPTED",
        version: 5,
        responseStatus: "ACCEPTED",
      }),
      reject: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "CANCELLED",
        responseStatus: "REJECTED",
        cancellationId: "can-1",
      }),
      providerCancel: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "CANCELLED",
        cancellationId: "can-1",
      }),
      listReasons: vi.fn().mockResolvedValue([]),
      getStaffDossier: vi.fn().mockResolvedValue({ bookingId: "bk-1" }),
      staffCancel: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "CANCELLED",
        cancellationId: "can-1",
      }),
    };
    const authenticateAccess = (
      _req: unknown,
      res: { locals: Record<string, unknown> },
      next: () => void,
    ) => {
      res.locals["authenticationPrincipal"] = principal;
      next();
    };
    const deps = {
      authenticateAccess: authenticateAccess as never,
      rateLimiter: new MemoryRateLimiterAdapter(),
      privacyHashSecret: "privacy-secret",
      service: service as never,
    };
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      rateLimiter: new MemoryRateLimiterAdapter(),
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1/providers", createBookingProviderResponseRouter(deps));
        expressApp.use("/api/v1/bookings", createBookingReasonsRouter(deps));
        expressApp.use("/api/v1/staff/bookings", createBookingStaffResponseRouter(deps));
      },
    });

    const inbox = await request(app).get("/api/v1/providers/prov-1/bookings/inbox");
    expect(inbox.status).toBe(200);

    const dossier = await request(app).get("/api/v1/providers/prov-1/bookings/bk-1");
    expect(dossier.status).toBe(200);

    const accepted = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/accept")
      .set("Idempotency-Key", "idem-accept")
      .send({ version: 4 });
    expect(accepted.status).toBe(200);

    const rejected = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/reject")
      .set("Idempotency-Key", "idem-rej")
      .send({ version: 4, reasonCode: "PROVIDER_CANNOT_FULFILL" });
    expect(rejected.status).toBe(200);
    expect(JSON.stringify(rejected.body)).not.toMatch(/fee/i);

    const providerCancel = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/cancel")
      .set("Idempotency-Key", "idem-pc")
      .send({ version: 4, reasonCode: "PROVIDER_UNABLE_TO_CONTINUE" });
    expect(providerCancel.status).toBe(200);

    const reasons = await request(app).get(
      "/api/v1/bookings/cancellation-reasons?actor=PROVIDER&purpose=REJECT",
    );
    expect(reasons.status).toBe(200);

    const staffGet = await request(app).get("/api/v1/staff/bookings/bk-1");
    expect(staffGet.status).toBe(200);

    const staffCancel = await request(app)
      .post("/api/v1/staff/bookings/bk-1/cancel")
      .set("Idempotency-Key", "idem-st")
      .send({ version: 4, reasonCode: "STAFF_OPS_CANCEL" });
    expect(staffCancel.status).toBe(200);
  });

  it("rejects an unauthenticated inbox caller without enumerating bookings", async () => {
    const service = {
      listInbox: vi.fn().mockResolvedValue({ items: [{ bookingId: "bk-secret" }], nextCursor: null }),
    };
    const deps = {
      authenticateAccess: ((_req: unknown, _res: unknown, next: () => void) => {
        next();
      }) as never,
      rateLimiter: new MemoryRateLimiterAdapter(),
      privacyHashSecret: "privacy-secret",
      service: service as never,
    };
    const app = createTestApp({
      environment: createTestEnvironment(),
      logger: new TestLogger(),
      rateLimiter: new MemoryRateLimiterAdapter(),
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1/providers", createBookingProviderResponseRouter(deps));
      },
    });
    const inbox = await request(app).get("/api/v1/providers/prov-1/bookings/inbox");
    expect(inbox.status).toBeGreaterThanOrEqual(401);
    expect(inbox.status).toBeLessThan(500);
    expect(service.listInbox).not.toHaveBeenCalled();
    expect(JSON.stringify(inbox.body)).not.toMatch(/bk-secret/u);
  });
});
