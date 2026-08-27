import type { RequestHandler } from "express";

import { createProviderWorkforceRouter } from "../../../src/modules/providers/provider-workforce.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

const listItem = {
  workerId: "worker-1",
  providerId: "provider-1",
  fullLegalName: "Synthetic Worker",
  gender: "female" as const,
  workerType: "CLEANING_STAFF" as const,
  displayTitle: null,
  operationalStatus: "DRAFT" as const,
  supervisorCapable: false,
  currentTeamId: null,
  workerVersion: 1,
  profileVersion: 1,
};
const managementView = {
  viewScope: "PROVIDER_MANAGEMENT" as const,
  worker: listItem,
  operationalPhoneE164: "+201012345678",
  skills: ["Deep Cleaning"],
  loginAccessStatus: null,
  avatar: null,
};

function createHarness() {
  const service = {
    createWorkerDraft: vi.fn(async () => managementView),
    replaceWorkerProfile: vi.fn(async () => ({ ...managementView, worker: { ...listItem, profileVersion: 2 } })),
    listWorkers: vi.fn(async () => ({ items: [listItem], nextCursor: null })),
    getWorker: vi.fn(async () => managementView),
    upload: vi.fn(async () => ({ outcomeCode: "WORKER_AVATAR_ASSOCIATED", targetId: "worker-1", version: 2, impacts: [] })),
    remove: vi.fn(async () => ({ outcomeCode: "WORKER_AVATAR_REMOVED", targetId: "worker-1", version: 3, impacts: [] })),
    transitionWorkerLifecycle: vi.fn(),
    issueWorkerInvitation: vi.fn(),
    resendWorkerInvitation: vi.fn(),
    resetWorkerAccess: vi.fn(),
    revokeWorkerAccess: vi.fn(),
    changeWorkerAdminMembership: vi.fn(),
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
      userId: "owner-1",
      sessionId: "session-1",
      status: "ACTIVE",
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      pendingCategories: [],
      verificationOnly: false,
    };
    next();
  };
  const router = createProviderWorkforceRouter({ authenticateAccess, service });
  const app = createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/providers", router);
    },
  });
  return { app, service };
}

describe("Provider Worker create/read HTTP contract", () => {
  it("accepts the flat OpenAPI create shape and returns the private no-store view", async () => {
    const { app, service } = createHarness();
    const response = await request(app).post("/api/v1/providers/provider-1/workers").send({
      fullLegalName: "Synthetic Worker",
      gender: "female",
      operationalPhoneE164: "+201012345678",
      workerType: "CLEANING_STAFF",
      displayTitle: null,
      supervisorCapable: false,
      skillTags: ["Deep Cleaning"],
      expectedVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000121",
    });
    expect(response.status).toBe(201);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.data).toEqual(managementView);
    expect(service.createWorkerDraft).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "owner-1",
      sessionId: "session-1",
      providerId: "provider-1",
      profile: expect.objectContaining({ operationalPhoneE164: "+201012345678" }),
    }));
  });

  it("applies the documented optional create defaults before calling the service", async () => {
    const { app, service } = createHarness();
    const response = await request(app).post("/api/v1/providers/provider-1/workers").send({
      fullLegalName: "Synthetic Worker",
      gender: "female",
      operationalPhoneE164: "+201012345678",
      workerType: "CLEANING_STAFF",
      expectedVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000126",
    });
    expect(response.status).toBe(201);
    expect(service.createWorkerDraft).toHaveBeenCalledWith(expect.objectContaining({
      profile: expect.objectContaining({ displayTitle: null, supervisorCapable: false, skillTags: [] }),
    }));
  });

  it("returns a phone-free list and a private detail", async () => {
    const { app } = createHarness();
    const listed = await request(app).get("/api/v1/providers/provider-1/workers");
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).not.toContain("+201012345678");
    expect(listed.body.data).toEqual({ items: [listItem], nextCursor: null });
    expect(listed.body).not.toHaveProperty("meta");
    const detail = await request(app).get("/api/v1/providers/provider-1/workers/worker-1");
    expect(detail.status).toBe(200);
    expect(detail.headers["cache-control"]).toContain("no-store");
    expect(detail.body.data.operationalPhoneE164).toBe("+201012345678");
  });

  it("rejects the obsolete nested profile shape before the service", async () => {
    const { app, service } = createHarness();
    const response = await request(app).post("/api/v1/providers/provider-1/workers").send({
      profile: {
        fullLegalName: "Synthetic Worker",
        gender: "female",
        operationalPhoneE164: "+201012345678",
        workerType: "CLEANING_STAFF",
      },
      expectedProviderVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000121",
    });
    expect(response.status).toBe(400);
    expect(service.createWorkerDraft).not.toHaveBeenCalled();
  });

  it("replaces a Worker profile through the flat versioned PUT contract", async () => {
    const { app, service } = createHarness();
    const response = await request(app).put("/api/v1/providers/provider-1/workers/worker-1").send({
      fullLegalName: "Synthetic Worker",
      gender: "female",
      operationalPhoneE164: "+201012345678",
      workerType: "CLEANING_STAFF",
      displayTitle: "Lead Cleaner",
      supervisorCapable: true,
      skillTags: ["Deep Cleaning"],
      expectedVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000122",
    });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(service.replaceWorkerProfile).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "provider-1",
      workerId: "worker-1",
      expectedVersion: 1,
      profile: expect.objectContaining({ supervisorCapable: true }),
    }));
  });

  it("rejects an incomplete full-replacement profile before the service", async () => {
    const { app, service } = createHarness();
    const response = await request(app).put("/api/v1/providers/provider-1/workers/worker-1").send({
      fullLegalName: "Synthetic Worker",
      gender: "female",
      operationalPhoneE164: "+201012345678",
      workerType: "CLEANING_STAFF",
      expectedVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000127",
    });
    expect(response.status).toBe(400);
    expect(service.replaceWorkerProfile).not.toHaveBeenCalled();
  });

  it("accepts bounded multipart avatar upload and forwards only trusted file facts", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/avatar")
      .field("expectedVersion", "1")
      .field("idempotencyKey", "00000000-0000-4000-8000-000000000123")
      .attach("file", Buffer.from("synthetic-image"), { filename: "avatar.png", contentType: "image/png" });
    expect(response.status).toBe(202);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(service.upload).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "owner-1",
      providerId: "provider-1",
      workerId: "worker-1",
      expectedVersion: 1,
      declaredContentType: "image/png",
      bytes: Buffer.from("synthetic-image"),
    }));
  });

  it("removes an avatar with the versioned JSON command", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .delete("/api/v1/providers/provider-1/workers/worker-1/avatar")
      .send({ expectedVersion: 2, idempotencyKey: "00000000-0000-4000-8000-000000000124" });
    expect(response.status).toBe(200);
    expect(service.remove).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 2 }));
  });

  it("rejects unsupported avatar media before the application service", async () => {
    const { app, service } = createHarness();
    const response = await request(app)
      .post("/api/v1/providers/provider-1/workers/worker-1/avatar")
      .field("expectedVersion", "1")
      .field("idempotencyKey", "00000000-0000-4000-8000-000000000125")
      .attach("file", Buffer.from("gif"), { filename: "avatar.gif", contentType: "image/gif" });
    expect(response.status).toBe(415);
    expect(service.upload).not.toHaveBeenCalled();
  });
});
