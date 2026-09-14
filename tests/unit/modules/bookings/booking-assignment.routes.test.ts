import {
  createBookingAssignmentRouter,
} from "#modules/bookings/bookings.assignment.routes";
import { createBookingWorkerVisibilityRouter } from "#modules/bookings/bookings.worker-visibility.routes";
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

describe("R1-P17 booking assignment routes", () => {
  it("mounts provider assignment and worker visibility surfaces", async () => {
    const service = {
      assignTeam: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "ASSIGNED",
        version: 6,
        assignmentId: "asg-1",
      }),
      assignWorkers: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "ASSIGNED",
        version: 6,
        assignmentId: "asg-2",
      }),
      replaceTeam: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "ASSIGNED",
        version: 7,
        assignmentId: "asg-3",
      }),
      replaceWorkers: vi.fn().mockResolvedValue({
        bookingId: "bk-1",
        status: "ASSIGNED",
        version: 8,
        assignmentId: "asg-4",
      }),
      getCurrent: vi.fn().mockResolvedValue({ assignmentId: "asg-1" }),
      getHistory: vi.fn().mockResolvedValue({ items: [] }),
      listWorkerAssignments: vi.fn().mockResolvedValue({ items: [] }),
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
        expressApp.use("/api/v1/providers", createBookingAssignmentRouter(deps));
        expressApp.use(
          "/api/v1/workers",
          createBookingWorkerVisibilityRouter({
            authenticateAccess: deps.authenticateAccess,
            service: deps.service,
          }),
        );
      },
    });

    const team = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/assignments/team")
      .set("Idempotency-Key", "idem-team")
      .send({ expectedBookingVersion: 5, teamId: "team-1" });
    expect(team.status).toBe(200);

    const workers = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/assignments/workers")
      .set("Idempotency-Key", "idem-workers")
      .send({ expectedBookingVersion: 5, workerIds: ["w1"] });
    expect(workers.status).toBe(200);

    const replaceTeam = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/assignments/team/replace")
      .set("Idempotency-Key", "idem-rt")
      .send({ expectedBookingVersion: 6, teamId: "team-1" });
    expect(replaceTeam.status).toBe(200);

    const replaceWorkers = await request(app)
      .post("/api/v1/providers/prov-1/bookings/bk-1/assignments/workers/replace")
      .set("Idempotency-Key", "idem-rw")
      .send({ expectedBookingVersion: 7, workerIds: ["w2"] });
    expect(replaceWorkers.status).toBe(200);

    const current = await request(app).get(
      "/api/v1/providers/prov-1/bookings/bk-1/assignments/current",
    );
    expect(current.status).toBe(200);

    const history = await request(app).get(
      "/api/v1/providers/prov-1/bookings/bk-1/assignments/history",
    );
    expect(history.status).toBe(200);

    const mine = await request(app).get("/api/v1/workers/me/assignments");
    expect(mine.status).toBe(200);
    expect(service.listWorkerAssignments).toHaveBeenCalledWith({
      workerUserId: "owner-1",
    });
  });
});
