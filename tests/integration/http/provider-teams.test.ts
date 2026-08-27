import type { RequestHandler } from "express";

import { createProviderWorkforceRouter } from "../../../src/modules/providers/provider-workforce.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");
const teamItem = { teamId: "team-1", providerId: "provider-1", name: "North Crew", status: "ACTIVE" as const, primarySupervisorWorkerId: "worker-1", currentMemberCount: 1, validCleanerCount: 1, version: 4 };
const teamMember = { membershipId: "membership-1", workerId: "worker-1", fullLegalName: "Cleaner", gender: "female" as const, workerType: "CLEANING_STAFF" as const, cleans: true, workerStatus: "ACTIVE" as const, membershipVersion: 2 };
const teamDetail = { team: teamItem, members: [teamMember] };
const accepted = { outcomeCode: "ACCEPTED", targetId: "team-1", version: 5, impacts: [] };

function createHarness() {
  const service = {
    createWorkerDraft: vi.fn(), replaceWorkerProfile: vi.fn(), listWorkers: vi.fn(), getWorker: vi.fn(), upload: vi.fn(), remove: vi.fn(),
    transitionWorkerLifecycle: vi.fn(), issueWorkerInvitation: vi.fn(), resendWorkerInvitation: vi.fn(), resetWorkerAccess: vi.fn(), revokeWorkerAccess: vi.fn(), changeWorkerAdminMembership: vi.fn(),
    createTeamDraft: vi.fn(async () => ({ ...accepted, outcomeCode: "TEAM_DRAFT_CREATED" })),
    replaceTeamName: vi.fn(async () => ({ ...accepted, outcomeCode: "TEAM_NAME_REPLACED" })),
    transitionTeamLifecycle: vi.fn(async () => ({ ...accepted, outcomeCode: "TEAM_DEACTIVATED" })),
    changeTeamMembership: vi.fn(async () => ({ ...accepted, outcomeCode: "TEAM_MEMBERSHIP_ADDED" })),
    changeTeamSupervisor: vi.fn(async () => ({ ...accepted, outcomeCode: "PRIMARY_SUPERVISOR_ASSIGNED" })),
    listTeams: vi.fn(async () => ({ items: [teamItem], nextCursor: null })),
    getTeam: vi.fn(async () => teamDetail),
    listTeamHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    getWorkforceReadiness: vi.fn(),
    listWorkerHistory: vi.fn(),
  };
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = { userId: "admin-1", sessionId: "session-1", status: "ACTIVE", accountCategories: [], verifiedCategories: [], pendingCategories: [], verificationOnly: false };
    next();
  };
  const app = createTestApp({ environment: createTestEnvironment(), logger: new TestLogger(), mountTestRoutes(application) { application.use("/api/v1/providers", createProviderWorkforceRouter({ authenticateAccess, service })); } });
  return { app, service };
}

const meta = { expectedVersion: 4, idempotencyKey: "00000000-0000-4000-8000-000000000901" };

describe("Provider Team HTTP contract", () => {
  it("returns phone-free bounded Team list/detail/history with private caching", async () => {
    const { app } = createHarness();
    for (const path of ["/api/v1/providers/provider-1/teams", "/api/v1/providers/provider-1/teams/team-1", "/api/v1/providers/provider-1/teams/team-1/history"]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(JSON.stringify(response.body)).not.toMatch(/phone|\+2010/iu);
    }
  });

  it("creates and renames a Team through normalized command surfaces", async () => {
    const { app, service } = createHarness();
    const created = await request(app).post("/api/v1/providers/provider-1/teams").send({ ...meta, name: " North  Crew " });
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(expect.objectContaining({ outcomeCode: "TEAM_DRAFT_CREATED", targetId: "team-1", version: 5, impacts: [] }));
    expect(service.createTeamDraft).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "admin-1", name: " North  Crew " }));
    const renamed = await request(app).put("/api/v1/providers/provider-1/teams/team-1").send({ ...meta, name: "North Crew 2" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data).toEqual(expect.objectContaining({ outcomeCode: "TEAM_NAME_REPLACED", targetId: "team-1", version: 5, impacts: [] }));
    expect(service.replaceTeamName).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", name: "North Crew 2" }));
  });

  it("creates a nameless DRAFT Team with the documented null default", async () => {
    const { app, service } = createHarness();
    const response = await request(app).post("/api/v1/providers/provider-1/teams").send(meta);
    expect(response.status).toBe(201);
    expect(service.createTeamDraft).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });

  it("dispatches lifecycle, membership, and Supervisor version facts", async () => {
    const { app, service } = createHarness();
    const lifecycle = await request(app).post("/api/v1/providers/provider-1/teams/team-1/lifecycle-commands").send({ ...meta, action: "DEACTIVATE" });
    expect(lifecycle.status).toBe(200);
    const membership = await request(app).post("/api/v1/providers/provider-1/teams/team-1/membership-commands").send({ ...meta, action: "ADD", workerId: "worker-2", cleans: false, expectedWorkerVersion: 3 });
    expect(membership.status).toBe(201);
    expect(service.changeTeamMembership).toHaveBeenCalledWith(expect.objectContaining({ workerId: "worker-2", expectedWorkerVersion: 3, cleans: false }));
    const supervisor = await request(app).post("/api/v1/providers/provider-1/teams/team-1/supervisor-commands").send({ ...meta, action: "ASSIGN", workerId: "worker-1", expectedWorkerVersion: 3, expectedMembershipVersion: 2 });
    expect(supervisor.status).toBe(200);
    expect(service.changeTeamSupervisor).toHaveBeenCalledWith(expect.objectContaining({ expectedMembershipVersion: 2 }));
  });

  it("rejects missing Supervisor CAS and obsolete extra fields before the service", async () => {
    const { app, service } = createHarness();
    const missing = await request(app).post("/api/v1/providers/provider-1/teams/team-1/supervisor-commands").send({ ...meta, action: "ASSIGN", workerId: "worker-1" });
    expect(missing.status).toBe(400);
    expect(service.changeTeamSupervisor).not.toHaveBeenCalled();
    const extra = await request(app).post("/api/v1/providers/provider-1/teams/team-1/lifecycle-commands").send({ ...meta, action: "DEACTIVATE", reasonCode: "OTHER" });
    expect(extra.status).toBe(400);
    expect(service.transitionTeamLifecycle).not.toHaveBeenCalled();
  });
});
