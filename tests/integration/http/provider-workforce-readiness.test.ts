import type { RequestHandler } from "express";

import { createProviderWorkforceRouter } from "../../../src/modules/providers/provider-workforce.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

describe("Provider workforce readiness HTTP", () => {
  it("returns the derived projection with private no-store policy", async () => {
    const getWorkforceReadiness = vi.fn(async () => ({ providerId: "provider-1", workforceVersion: 7, workersReady: true, qualifyingWorkerCount: 1, blockerCodes: [] as const }));
    const service = {
      createWorkerDraft: vi.fn(), replaceWorkerProfile: vi.fn(), listWorkers: vi.fn(), getWorker: vi.fn(), upload: vi.fn(), remove: vi.fn(),
      transitionWorkerLifecycle: vi.fn(), issueWorkerInvitation: vi.fn(), resendWorkerInvitation: vi.fn(), resetWorkerAccess: vi.fn(), revokeWorkerAccess: vi.fn(), changeWorkerAdminMembership: vi.fn(),
      createTeamDraft: vi.fn(), replaceTeamName: vi.fn(), transitionTeamLifecycle: vi.fn(), changeTeamMembership: vi.fn(), changeTeamSupervisor: vi.fn(), listTeams: vi.fn(), getTeam: vi.fn(), listTeamHistory: vi.fn(),
      getWorkforceReadiness,
      listWorkerHistory: vi.fn(),
    };
    const authenticateAccess: RequestHandler = (_request, response, next) => {
      response.locals["authenticationPrincipal"] = { userId: "owner-1", sessionId: "session-1", status: "ACTIVE", accountCategories: [], verifiedCategories: [], pendingCategories: [], verificationOnly: false };
      next();
    };
    const app = createTestApp({ environment: createTestEnvironment(), logger: new TestLogger(), mountTestRoutes(application) { application.use("/api/v1/providers", createProviderWorkforceRouter({ authenticateAccess, service })); } });
    const response = await request(app).get("/api/v1/providers/provider-1/workforce-readiness");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.data).toEqual({ providerId: "provider-1", workforceVersion: 7, workersReady: true, qualifyingWorkerCount: 1, blockerCodes: [] });
    expect(getWorkforceReadiness).toHaveBeenCalledWith({ actorUserId: "owner-1", providerId: "provider-1" });
  });
});
