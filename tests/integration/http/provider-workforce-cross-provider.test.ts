import type { RequestHandler } from "express";

import { WorkforcePolicyError } from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { createProviderWorkforceRouter } from "../../../src/modules/providers/provider-workforce.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

function createHarness() {
  const missing = () => vi.fn(async () => { throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND"); });
  const service = {
    createWorkerDraft: missing(), replaceWorkerProfile: missing(), listWorkers: missing(), getWorker: missing(), upload: missing(), remove: missing(),
    transitionWorkerLifecycle: missing(), issueWorkerInvitation: missing(), resendWorkerInvitation: missing(), resetWorkerAccess: missing(), revokeWorkerAccess: missing(), changeWorkerAdminMembership: missing(),
    createTeamDraft: missing(), replaceTeamName: missing(), transitionTeamLifecycle: missing(), changeTeamMembership: missing(), changeTeamSupervisor: missing(),
    listTeams: missing(), getTeam: missing(), listTeamHistory: missing(), getWorkforceReadiness: missing(), listWorkerHistory: missing(),
  };
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = {
      userId: "foreign-manager", sessionId: "foreign-session", status: "ACTIVE",
      accountCategories: [], verifiedCategories: [], pendingCategories: [], verificationOnly: false,
    };
    next();
  };
  const app = createTestApp({
    environment: createTestEnvironment(), logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/providers", createProviderWorkforceRouter({ authenticateAccess, service }));
    },
  });
  return { app };
}

const provider = "private-provider-should-not-echo";
const worker = "private-worker-should-not-echo";
const team = "private-team-should-not-echo";
const meta = { expectedVersion: 4, idempotencyKey: "00000000-0000-4000-8000-000000000991" };

describe("R1-P07 cross-Provider HTTP non-enumeration", () => {
  it("uses one existence-safe envelope for every Worker, Team, history, command, and readiness family", async () => {
    const { app } = createHarness();
    const attempts = [
      () => request(app).get(`/api/v1/providers/${provider}/workers`),
      () => request(app).get(`/api/v1/providers/${provider}/workers/${worker}`),
      () => request(app).get(`/api/v1/providers/${provider}/workers/${worker}/history`),
      () => request(app).post(`/api/v1/providers/${provider}/workers/${worker}/lifecycle-commands`).send({ ...meta, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", confirmTeamImpact: false, confirmReadinessImpact: false }),
      () => request(app).post(`/api/v1/providers/${provider}/workers/${worker}/login-access-commands`).send({ ...meta, action: "REVOKE_ACCESS", expectedAccessVersion: 2, reasonCode: "SECURITY_CONCERN", recentAuthenticationProof: "opaque-proof-must-not-echo" }),
      () => request(app).get(`/api/v1/providers/${provider}/teams`),
      () => request(app).get(`/api/v1/providers/${provider}/teams/${team}`),
      () => request(app).get(`/api/v1/providers/${provider}/teams/${team}/history`),
      () => request(app).post(`/api/v1/providers/${provider}/teams/${team}/lifecycle-commands`).send({ ...meta, action: "DEACTIVATE" }),
      () => request(app).get(`/api/v1/providers/${provider}/workforce-readiness`),
    ];

    for (const attempt of attempts) {
      const response = await attempt();
      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({
        code: "WORKFORCE_RESOURCE_NOT_FOUND",
        statusCode: 404,
      });
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(provider);
      expect(serialized).not.toContain(worker);
      expect(serialized).not.toContain(team);
      expect(serialized).not.toContain("opaque-proof-must-not-echo");
      expect(serialized).not.toMatch(/phone|email|proof|membership/iu);
    }
  });
});
