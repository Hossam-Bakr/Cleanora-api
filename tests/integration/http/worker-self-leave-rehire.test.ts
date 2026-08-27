import type { RequestHandler } from "express";

import { createProviderWorkerSelfRouter } from "../../../src/modules/providers/provider-worker-self.routes.js";
import type { LeaveCurrentProviderCommand } from "../../../src/modules/providers/provider-worker-self.service.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");
const idempotencyKey = "00000000-0000-4000-8000-000000000501";

function createHarness() {
  const service = {
    getCurrent: vi.fn(async () => ({
      viewScope: "SELF" as const,
      worker: {
        workerId: "worker-1",
        providerId: "provider-1",
        fullLegalName: "Self Worker",
        gender: "female" as const,
        workerType: "CLEANING_STAFF" as const,
        displayTitle: null,
        operationalStatus: "ACTIVE" as const,
        supervisorCapable: false,
        currentTeamId: null,
        workerVersion: 7,
        profileVersion: 2,
      },
      operationalPhoneE164: "+201011111111",
      skills: [],
      loginAccessStatus: "ACTIVE" as const,
      avatar: null,
    })),
    leave: vi.fn(async (_command: LeaveCurrentProviderCommand) => ({ outcomeCode: "WORKER_DEPARTED", targetId: "worker-1", version: 8, impacts: [] })),
  };
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = {
      userId: "worker-user-1",
      sessionId: "session-1",
      status: "ACTIVE",
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      pendingCategories: [],
      verificationOnly: false,
    };
    next();
  };
  const app = createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/workers", createProviderWorkerSelfRouter({ authenticateAccess, service }));
    },
  });
  return { app, service };
}

describe("Worker self read/leave HTTP contract", () => {
  it("uses only the authenticated principal for current Worker context and returns private no-store data", async () => {
    const { app, service } = createHarness();
    const response = await request(app).get("/api/v1/workers/me");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.data).toMatchObject({ viewScope: "SELF", operationalPhoneE164: "+201011111111" });
    expect(service.getCurrent).toHaveBeenCalledWith("worker-user-1");
  });

  it("passes exact CAS and impact confirmations without accepting actor/provider identifiers from the body", async () => {
    const { app, service } = createHarness();
    const response = await request(app).post("/api/v1/workers/me/leave").send({
      expectedVersion: 7,
      expectedTeamVersion: 5,
      expectedMembershipVersion: 4,
      confirmTeamImpact: true,
      confirmReadinessImpact: true,
      idempotencyKey,
    });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(service.leave).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "worker-user-1",
      expectedVersion: 7,
      expectedTeamVersion: 5,
      expectedMembershipVersion: 4,
      confirmTeamImpact: true,
      confirmReadinessImpact: true,
    }));
    expect(service.leave.mock.calls[0]?.[0]).not.toHaveProperty("providerId");
    expect(service.leave.mock.calls[0]?.[0]).not.toHaveProperty("workerId");
  });

  it("rejects missing CAS and untrusted identity fields before invoking the service", async () => {
    const { app, service } = createHarness();
    expect((await request(app).post("/api/v1/workers/me/leave").send({ idempotencyKey })).status).toBe(400);
    expect((await request(app).post("/api/v1/workers/me/leave").send({
      expectedVersion: 7,
      idempotencyKey,
      actorUserId: "attacker",
    })).status).toBe(400);
    expect(service.leave).not.toHaveBeenCalled();
  });
});
