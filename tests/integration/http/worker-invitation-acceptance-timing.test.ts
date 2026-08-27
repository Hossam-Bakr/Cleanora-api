import { performance } from "node:perf_hooks";

import type { RequestHandler } from "express";

import { createProviderWorkforceInvitationRouter } from "../../../src/modules/providers/provider-workforce-invitation.routes.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");
const SAMPLE_SIZE = 100;
const TWO_MINUTES_MS = 120_000;

function createHarness() {
  const inspect = vi.fn(async () => ({
    providerId: "provider-1", workerId: "worker-1", invitationVersion: 1,
    expectedVersion: 1, locale: "EN" as const, maskedEmail: "w***@example.invalid",
    expiresAt: new Date("2026-08-25T12:00:00.000Z"), onboardingMode: "AUTHENTICATE_OR_CREATE" as const,
    expectedWorkerVersion: 1, expectedAccessVersion: 1,
  }));
  const start = vi.fn(async () => ({
    challengeId: "challenge-1", maskedDestination: "w***@example.invalid",
    expiresAt: new Date("2026-08-25T12:10:00.000Z"),
  }));
  const verifyEmail = vi.fn(async () => ({
    principal: { userId: "worker-user-1", sessionId: "restricted-session-1", accountCategories: [], verifiedCategories: [], pendingCategories: [], status: "ACTIVE" as const, verificationOnly: true, invitationOnboardingOnly: true },
    emailNormalized: "worker@example.invalid", capability: "WORKER_INVITATION_ONBOARDING" as const,
    allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"] as const,
    accessToken: "synthetic-access-token", accessExpiresAt: new Date("2026-08-25T12:05:00.000Z"),
    refreshToken: "synthetic-refresh-token", refreshExpiresAt: new Date("2026-09-01T12:00:00.000Z"),
  }));
  const accept = vi.fn(async () => ({
    viewScope: "SELF" as const,
    worker: { workerId: "worker-1", providerId: "provider-1", fullLegalName: "Synthetic Worker", gender: "female" as const, workerType: "CLEANING_STAFF" as const, displayTitle: null, operationalStatus: "ACTIVE" as const, supervisorCapable: false, currentTeamId: null, workerVersion: 2, profileVersion: 1 },
    operationalPhoneE164: "+201011111111", skills: [], loginAccessStatus: "ACTIVE" as const, avatar: null,
  }));
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = { userId: "worker-user-1", sessionId: "restricted-session-1", status: "ACTIVE", accountCategories: [], verifiedCategories: [], pendingCategories: [], verificationOnly: true, invitationOnboardingOnly: true };
    next();
  };
  const app = createTestApp({
    environment: createTestEnvironment(), logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/worker-invitations", createProviderWorkforceInvitationRouter({ authenticateAccess, service: { query: { inspect }, onboarding: { start, verifyEmail }, acceptance: { accept } } }));
    },
  });
  return { app, inspect, start, verifyEmail, accept };
}

function idempotencyKey(sample: number, step: number): string {
  return `00000000-0000-4000-8000-${String((sample * 10) + step).padStart(12, "0")}`;
}

describe("SC-002 Worker invitation acceptance timing", () => {
  it("accepts at least 95% of 100 valid first attempts within two minutes, excluding email delivery", async () => {
    const harness = createHarness();
    const elapsed: number[] = [];
    let firstAttemptSuccesses = 0;

    for (let sample = 1; sample <= SAMPLE_SIZE; sample += 1) {
      const proof = `synthetic-valid-proof-${sample}`;
      const startedAt = performance.now();
      const inspected = await request(harness.app).post("/api/v1/worker-invitations/inspect").send({ invitationProof: proof });
      const started = await request(harness.app).post("/api/v1/worker-invitations/onboarding/start").send({ invitationProof: proof, password: "Synthetic-Strong-Password-123!", expectedVersion: 1, idempotencyKey: idempotencyKey(sample, 1) });
      const verified = await request(harness.app).post("/api/v1/worker-invitations/onboarding/verify-email").send({ invitationProof: proof, challengeId: "challenge-1", code: "123456", expectedVersion: 1, idempotencyKey: idempotencyKey(sample, 2) });
      const accepted = await request(harness.app).post("/api/v1/worker-invitations/accept").send({ invitationProof: proof, operationalPhoneE164: "+201011111111", expectedVersion: 1, expectedWorkerVersion: 1, expectedAccessVersion: 1, idempotencyKey: idempotencyKey(sample, 3) });
      elapsed.push(performance.now() - startedAt);
      if ([inspected.status, started.status, verified.status, accepted.status].every((status) => status === 200)) {
        firstAttemptSuccesses += 1;
      }
    }

    const withinTwoMinutes = elapsed.filter((duration) => duration <= TWO_MINUTES_MS).length;
    expect(firstAttemptSuccesses / SAMPLE_SIZE).toBeGreaterThanOrEqual(0.95);
    expect(withinTwoMinutes / SAMPLE_SIZE).toBeGreaterThanOrEqual(0.95);
    expect(harness.inspect).toHaveBeenCalledTimes(SAMPLE_SIZE);
    expect(harness.start).toHaveBeenCalledTimes(SAMPLE_SIZE);
    expect(harness.verifyEmail).toHaveBeenCalledTimes(SAMPLE_SIZE);
    expect(harness.accept).toHaveBeenCalledTimes(SAMPLE_SIZE);
  }, 120_000);
});
