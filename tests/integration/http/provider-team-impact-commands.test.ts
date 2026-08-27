import type { RequestHandler } from "express";

import { WorkforcePolicyError } from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { createProviderWorkforceRouter } from "../../../src/modules/providers/provider-workforce.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

function serviceHarness() {
  return {
    createWorkerDraft: vi.fn(), replaceWorkerProfile: vi.fn(), listWorkers: vi.fn(), getWorker: vi.fn(), upload: vi.fn(), remove: vi.fn(),
    transitionWorkerLifecycle: vi.fn(), issueWorkerInvitation: vi.fn(), resendWorkerInvitation: vi.fn(), resetWorkerAccess: vi.fn(), revokeWorkerAccess: vi.fn(), changeWorkerAdminMembership: vi.fn(),
    createTeamDraft: vi.fn(), replaceTeamName: vi.fn(), transitionTeamLifecycle: vi.fn(),
    changeTeamMembership: vi.fn(), changeTeamSupervisor: vi.fn(), listTeams: vi.fn(), getTeam: vi.fn(), listTeamHistory: vi.fn(), getWorkforceReadiness: vi.fn(), listWorkerHistory: vi.fn(),
  };
}

function createHarness() {
  const service = serviceHarness();
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

const command = {
  expectedVersion: 7,
  expectedWorkerVersion: 5,
  expectedMembershipVersion: 3,
  idempotencyKey: "00000000-0000-4000-8000-000000000951",
  action: "REMOVE",
  workerId: "worker-1",
  membershipId: "membership-1",
};

describe("Provider Team final-cleaner impact HTTP commands", () => {
  it("returns a phone-free warning projection when confirmation is absent", async () => {
    const { app, service } = createHarness();
    service.changeTeamMembership.mockRejectedValueOnce(new WorkforcePolicyError(
      "WORKFORCE_STATE_CONFLICT",
      { teamId: "team-1", teamVersion: 7, teamWillBecomeInactive: true },
    ));

    const response = await request(app)
      .post("/api/v1/providers/provider-1/teams/team-1/membership-commands")
      .send({ ...command, confirmLastCleanerImpact: false });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: "WORKFORCE_STATE_CONFLICT",
      statusCode: 409,
      details: { teamId: "team-1", teamVersion: 7, teamWillBecomeInactive: true },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/phone|operational|worker-1|membership-1|\+20/iu);
  });

  it("forwards an explicit Owner confirmation and all locked-row CAS facts", async () => {
    const { app, service } = createHarness();
    service.changeTeamMembership.mockResolvedValueOnce({
      outcomeCode: "TEAM_MEMBERSHIP_REMOVED",
      targetId: "membership-1",
      version: 4,
      impacts: [{ teamId: "team-1", teamVersion: 8, teamWillBecomeInactive: true }],
    });

    const response = await request(app)
      .post("/api/v1/providers/provider-1/teams/team-1/membership-commands")
      .send({ ...command, confirmLastCleanerImpact: true });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(service.changeTeamMembership).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "owner-1",
      providerId: "provider-1",
      teamId: "team-1",
      expectedVersion: 7,
      expectedWorkerVersion: 5,
      expectedMembershipVersion: 3,
      confirmLastCleanerImpact: true,
    }));
    expect(response.body.data.impacts).toEqual([
      { teamId: "team-1", teamVersion: 8, teamWillBecomeInactive: true },
    ]);
  });

  it("keeps a stale confirmed command conflict-safe without leaking private identities", async () => {
    const { app, service } = createHarness();
    service.changeTeamMembership.mockRejectedValueOnce(new WorkforcePolicyError(
      "WORKFORCE_STATE_CONFLICT",
      { teamId: "team-1", teamVersion: 8, teamWillBecomeInactive: true },
    ));

    const response = await request(app)
      .post("/api/v1/providers/provider-1/teams/team-1/membership-commands")
      .send({ ...command, confirmLastCleanerImpact: true });

    expect(response.status).toBe(409);
    expect(response.body.error.details).toEqual({
      teamId: "team-1", teamVersion: 8, teamWillBecomeInactive: true,
    });
    expect(JSON.stringify(response.body)).not.toMatch(/worker-1|membership-1|phone|@/iu);
  });
});
