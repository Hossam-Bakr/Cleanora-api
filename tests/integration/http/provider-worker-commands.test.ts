import type { RequestHandler } from "express";

import { WorkforcePolicyError } from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { createProviderWorkforceRouter } from "../../../src/modules/providers/provider-workforce.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");
const commandResult = { outcomeCode: "ACCEPTED", targetId: "worker-1", version: 5, impacts: [] };

function createHarness() {
  const service = {
    createWorkerDraft: vi.fn(), replaceWorkerProfile: vi.fn(), listWorkers: vi.fn(), getWorker: vi.fn(), upload: vi.fn(), remove: vi.fn(),
    transitionWorkerLifecycle: vi.fn(async () => ({ ...commandResult, outcomeCode: "WORKER_DEACTIVATED" })),
    issueWorkerInvitation: vi.fn(async () => ({ ...commandResult, outcomeCode: "WORKER_INVITATION_ISSUED" })),
    resendWorkerInvitation: vi.fn(async () => ({ ...commandResult, outcomeCode: "WORKER_INVITATION_RESENT" })),
    resetWorkerAccess: vi.fn(async () => ({ ...commandResult, outcomeCode: "WORKER_LOGIN_ACCESS_RESET" })),
    revokeWorkerAccess: vi.fn(async () => ({ ...commandResult, outcomeCode: "WORKER_LOGIN_ACCESS_REVOKED" })),
    changeWorkerAdminMembership: vi.fn(async () => ({ ...commandResult, outcomeCode: "PROVIDER_ADMIN_GRANTED" })),
    createTeamDraft: vi.fn(),
    replaceTeamName: vi.fn(),
    transitionTeamLifecycle: vi.fn(),
    changeTeamMembership: vi.fn(),
    changeTeamSupervisor: vi.fn(),
    listTeams: vi.fn(),
    getTeam: vi.fn(),
    listTeamHistory: vi.fn(),
    getWorkforceReadiness: vi.fn(),
    listWorkerHistory: vi.fn(),
  };
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = {
      userId: "owner-1", sessionId: "session-1", status: "ACTIVE",
      accountCategories: ["INDIVIDUAL"], verifiedCategories: ["INDIVIDUAL"], pendingCategories: [], verificationOnly: false,
    };
    next();
  };
  const app = createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/providers", createProviderWorkforceRouter({ authenticateAccess, service }));
    },
  });
  return { app, service };
}

const commandMeta = {
  expectedVersion: 4,
  idempotencyKey: "00000000-0000-4000-8000-000000000701",
};

describe("Provider Worker command HTTP contracts", () => {
  it("forwards lifecycle actor/session/provider/Worker/request facts and returns no-store", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/lifecycle-commands")
      .send({ ...commandMeta, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", confirmTeamImpact: false, confirmReadinessImpact: false });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(service.transitionWorkerLifecycle).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "owner-1", sessionId: "session-1", providerId: "provider-1", workerId: "worker-1",
      action: "DEACTIVATE", requestId: expect.any(String),
    }));
  });

  it.each([
    ["ISSUE_INVITATION", "issueWorkerInvitation", 201],
    ["RESEND_INVITATION", "resendWorkerInvitation", 201],
    ["RESET_ACCESS", "resetWorkerAccess", 201],
  ] as const)("dispatches %s only to its exact use case", async (action, method, expectedStatus) => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/login-access-commands")
      .send({
        ...commandMeta, action, expectedAccessVersion: 2, email: "worker@example.invalid", locale: "EN",
        recentAuthenticationProof: "opaque-proof-value",
      });
    expect(response.status).toBe(expectedStatus);
    expect(service[method]).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "owner-1",
      sessionId: "session-1",
      ...(action === "RESET_ACCESS"
        ? { recentAuthenticationProof: "opaque-proof-value" }
        : { opaqueRecentAuthenticationProof: "opaque-proof-value" }),
    }));
    expect(JSON.stringify(response.body)).not.toContain("opaque-proof-value");
  });

  it("dispatches active access revocation with its exact reason catalog", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/login-access-commands")
      .send({
        ...commandMeta, action: "REVOKE_ACCESS", expectedAccessVersion: 2,
        reasonCode: "SECURITY_CONCERN", recentAuthenticationProof: "opaque-proof-value",
      });
    expect(response.status).toBe(200);
    expect(service.revokeWorkerAccess).toHaveBeenCalledWith(expect.objectContaining({
      reasonCode: "SECURITY_CONCERN", recentAuthenticationProof: "opaque-proof-value",
    }));
  });

  it("dispatches Admin grant with Worker and membership CAS versions", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/admin-membership-commands")
      .send({
        ...commandMeta, action: "GRANT", expectedMembershipVersion: null,
        reasonCode: "OPERATIONAL_RESPONSIBILITY", recentAuthenticationProof: "opaque-proof-value",
      });
    expect(response.status).toBe(200);
    expect(service.changeWorkerAdminMembership).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 4, expectedMembershipVersion: null, recentAuthenticationProof: "opaque-proof-value",
    }));
  });

  it("rejects wrong reason catalogs and extra fields before any service call", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/lifecycle-commands")
      .send({ ...commandMeta, action: "DEACTIVATE", reasonCode: "SECURITY_CONCERN", unexpected: true });
    expect(response.status).toBe(400);
    expect(service.transitionWorkerLifecycle).not.toHaveBeenCalled();
  });

  it("maps cross-Provider denial to one existence-safe response", async () => {
    const { app, service } = createHarness();
    service.changeWorkerAdminMembership.mockRejectedValueOnce(new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND"));
    const response = await request(app)
      .post("/api/v1/providers/other-provider/workers/private-worker/admin-membership-commands")
      .send({
        ...commandMeta, action: "GRANT", expectedMembershipVersion: null,
        reasonCode: "OPERATIONAL_RESPONSIBILITY", recentAuthenticationProof: "opaque-proof-value",
      });
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).not.toContain("private-worker");
    expect(JSON.stringify(response.body)).not.toContain("other-provider");
  });
});
