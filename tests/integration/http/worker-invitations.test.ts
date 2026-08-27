import type { RequestHandler } from "express";

import { createProviderWorkforceInvitationRouter } from "../../../src/modules/providers/provider-workforce-invitation.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");
const proof = "synthetic.write-only.invitation-proof";
const commandMeta = {
  expectedVersion: 4,
  idempotencyKey: "00000000-0000-4000-8000-000000000401",
};

function createHarness(authenticated = true) {
  const inspect = vi.fn(async () => ({
    providerId: "provider-1",
    workerId: "worker-1",
    invitationVersion: 2,
    expectedVersion: 4,
    locale: "EN" as const,
    maskedEmail: "w***@example.invalid",
    expiresAt: new Date("2026-08-25T12:00:00.000Z"),
    onboardingMode: "AUTHENTICATE_OR_CREATE" as const,
    expectedWorkerVersion: 5,
    expectedAccessVersion: 3,
  }));
  const start = vi.fn(async () => ({
    challengeId: "challenge-1",
    maskedDestination: "w***@example.invalid",
    expiresAt: new Date("2026-08-22T12:10:00.000Z"),
  }));
  const verifyEmail = vi.fn(async () => ({
    principal: {
      userId: "worker-user-1",
      sessionId: "restricted-session-1",
      accountCategories: [],
      verifiedCategories: [],
      pendingCategories: [],
      status: "ACTIVE" as const,
      verificationOnly: true,
      invitationOnboardingOnly: true,
    },
    emailNormalized: "worker@example.invalid",
    capability: "WORKER_INVITATION_ONBOARDING" as const,
    allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"] as const,
    accessToken: "synthetic-access-token",
    accessExpiresAt: new Date("2026-08-22T12:05:00.000Z"),
    refreshToken: "synthetic-refresh-token",
    refreshExpiresAt: new Date("2026-08-29T12:00:00.000Z"),
  }));
  const accept = vi.fn(async () => ({
    viewScope: "SELF" as const,
    worker: {
      workerId: "worker-1",
      providerId: "provider-1",
      fullLegalName: "Synthetic Worker",
      gender: "female" as const,
      workerType: "CLEANING_STAFF" as const,
      displayTitle: null,
      operationalStatus: "DRAFT" as const,
      supervisorCapable: false,
      currentTeamId: null,
      workerVersion: 6,
      profileVersion: 2,
    },
    operationalPhoneE164: "+201011111111",
    skills: [],
    loginAccessStatus: "ACTIVE" as const,
    avatar: null,
  }));
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    if (authenticated) {
      response.locals["authenticationPrincipal"] = {
        userId: "worker-user-1",
        sessionId: "session-1",
        accountCategories: ["INDIVIDUAL"],
        verifiedCategories: ["INDIVIDUAL"],
        pendingCategories: [],
        status: "ACTIVE",
        verificationOnly: false,
      };
      next();
      return;
    }
    next();
  };
  const router = createProviderWorkforceInvitationRouter({
    authenticateAccess,
    service: { query: { inspect }, onboarding: { start, verifyEmail }, acceptance: { accept } },
  });
  const logger = new TestLogger();
  const app = createTestApp({
    environment: createTestEnvironment(),
    logger,
    mountTestRoutes(application) {
      application.use("/api/v1/worker-invitations", router);
    },
  });
  return { app, logger, inspect, start, verifyEmail, accept };
}

describe("Worker invitation public/restricted HTTP contracts", () => {
  it("inspects anonymously with no-store and never echoes the bearer proof", async () => {
    const harness = createHarness(false);
    const response = await request(harness.app)
      .post("/api/v1/worker-invitations/inspect")
      .send({ invitationProof: proof });
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body.data.maskedEmail).toBe("w***@example.invalid");
    expect(JSON.stringify(response.body)).not.toContain(proof);
  });

  it("starts and verifies fixed-email onboarding through strict write-only bodies", async () => {
    const harness = createHarness(false);
    const started = await request(harness.app)
      .post("/api/v1/worker-invitations/onboarding/start")
      .send({ ...commandMeta, invitationProof: proof, password: "Synthetic-Strong-Password-123!" });
    expect(started.status).toBe(200);
    expect(started.body.data).toEqual({
      challengeId: "challenge-1",
      maskedDestination: "w***@example.invalid",
      expiresAt: "2026-08-22T12:10:00.000Z",
    });
    const verified = await request(harness.app)
      .post("/api/v1/worker-invitations/onboarding/verify-email")
      .send({ ...commandMeta, invitationProof: proof, challengeId: "challenge-1", code: "123456" });
    expect(verified.status).toBe(200);
    expect(verified.body.data).toMatchObject({
      capability: "WORKER_INVITATION_ONBOARDING",
      allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"],
      accessToken: "synthetic-access-token",
      refreshToken: "synthetic-refresh-token",
    });
    expect(JSON.stringify(verified.body)).not.toContain(proof);
    expect(harness.start).toHaveBeenCalledWith(expect.objectContaining({ invitationProof: proof }));
    expect(harness.verifyEmail).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }));
  });

  it("requires an authenticated trusted principal for acceptance and forwards exact versions", async () => {
    const denied = createHarness(false);
    const body = {
      ...commandMeta,
      invitationProof: proof,
      expectedWorkerVersion: 5,
      expectedAccessVersion: 3,
      operationalPhoneE164: "+201011111111",
    };
    expect((await request(denied.app).post("/api/v1/worker-invitations/accept").send(body)).status).toBe(401);
    expect(denied.accept).not.toHaveBeenCalled();

    const allowed = createHarness(true);
    const response = await request(allowed.app).post("/api/v1/worker-invitations/accept").send(body);
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(allowed.accept).toHaveBeenCalledWith(expect.objectContaining({
      principal: expect.objectContaining({ userId: "worker-user-1" }),
      expectedVersion: 4,
      expectedWorkerVersion: 5,
      expectedAccessVersion: 3,
    }));
  });

  it("rejects unknown fields before any secret-bearing service call", async () => {
    const harness = createHarness(false);
    const response = await request(harness.app)
      .post("/api/v1/worker-invitations/inspect")
      .send({ invitationProof: proof, email: "attacker@example.invalid" });
    expect(response.status).toBe(400);
    expect(harness.inspect).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(proof);
  });
});
