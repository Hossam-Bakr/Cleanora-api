import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { bindPrismaClient, resetPrismaClientForTests } from "../../../src/database/prisma.js";
import { createWorkerInvitationIdentityOnboarding } from "../../../src/modules/authentication/infrastructure/prisma-worker-invitation-onboarding.js";
import {
  createPrismaWorkerIdentityAuthorityWriterFactory,
  createPrismaWorkerIdentityReaderFactory,
  createPrismaWorkerProofUseAuthorizerFactory,
  PrismaWorkerIdentityAuthorityWriter,
  PrismaWorkerIdentityReader,
  PrismaWorkerProofUseAuthorizer,
} from "../../../src/modules/authentication/infrastructure/prisma-worker-workforce.adapters.js";

const now = new Date("2026-08-23T08:00:00.000Z");

function onboardingDependencies(emailSend = vi.fn(async () => undefined)) {
  return {
    passwordHasher: { hash: vi.fn(async () => "password-hash"), verify: vi.fn(async () => true) },
    tokens: {
      issueAccess: vi.fn(() => ({ token: "access-token", expiresAt: new Date(now.getTime() + 900_000) })),
      issueRefresh: vi.fn(() => ({ token: "refresh-token", expiresAt: new Date(now.getTime() + 86_400_000) })),
      verifyAccess: vi.fn(), verifyRefresh: vi.fn(),
    },
    verifier: {
      randomOtp: vi.fn(() => "123456"),
      hashDestination: vi.fn(() => "destination-hash"),
      verifyOtp: vi.fn((subject: string, purpose: string, value: string) => `${subject}:${purpose}:${value}`),
      equals: vi.fn((left: string, right: string) => left === right),
      verifyRefresh: vi.fn(() => "refresh-verifier"),
    },
    email: { send: emailSend },
    accessTtlSeconds: 900,
    refreshTtlSeconds: 86_400,
    now: () => now,
  };
}

describe("R1-P07 Authentication-owned Worker adapters", () => {
  afterEach(() => resetPrismaClientForTests("test"));

  it("creates a restricted Worker onboarding identity, credential, OTP, and delivery state atomically", async () => {
    const transaction = {
      user: { create: vi.fn(async () => ({ id: "user-1" })) },
      userCredential: { create: vi.fn(async () => ({})) },
      otpCode: { create: vi.fn(async () => ({})) },
    };
    const client = {
      otpCode: {
        findUnique: vi.fn(async () => null),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      user: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const dependencies = onboardingDependencies();
    const onboarding = createWorkerInvitationIdentityOnboarding(dependencies as never);

    const result = await onboarding.startNewUser({
      invitationId: "invitation-1",
      invitationVersion: 1,
      fixedEmailNormalized: "Worker@Example.Invalid",
      password: "Strong-Worker-Password-123!",
      idempotencyKey: "start-key",
    });
    expect(result).toMatchObject({ userId: "user-1", maskedDestination: "wo***@***.invalid" });
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: { emailNormalized: "worker@example.invalid", accountCategories: [], verifiedCategories: [] },
    });
    expect(transaction.userCredential.create).toHaveBeenCalledWith({ data: { userId: "user-1", passwordHash: "password-hash" } });
    expect(transaction.otpCode.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ purpose: "WORKER_INVITATION_EMAIL_VERIFICATION", channel: "EMAIL", maxAttempts: 5 }),
    }));
    expect(dependencies.email.send).toHaveBeenCalledWith(expect.objectContaining({
      destination: "worker@example.invalid", value: "123456", purpose: "WORKER_INVITATION_EMAIL_VERIFICATION",
    }));
  });

  it("replays the same start challenge but rejects mismatched or already-registered identities", async () => {
    const priorChallenge = {
      id: "challenge-1", userId: "user-1", purpose: "WORKER_INVITATION_EMAIL_VERIFICATION",
      expiresAt: new Date(now.getTime() + 60_000),
    };
    const client = {
      otpCode: { findUnique: vi.fn(async () => priorChallenge) },
      user: { findUnique: vi.fn(async () => ({ id: "user-1", emailNormalized: "worker@example.invalid" })) },
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const onboarding = createWorkerInvitationIdentityOnboarding(onboardingDependencies() as never);
    await expect(onboarding.startNewUser({
      invitationId: "invitation-1", invitationVersion: 1, fixedEmailNormalized: "worker@example.invalid",
      password: "Strong-Worker-Password-123!", idempotencyKey: "start-key",
    })).resolves.toMatchObject({ userId: "user-1" });

    (client.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...priorChallenge, purpose: "SIGNUP_EMAIL_VERIFICATION" });
    await expect(onboarding.startNewUser({
      invitationId: "invitation-1", invitationVersion: 1, fixedEmailNormalized: "worker@example.invalid",
      password: "Strong-Worker-Password-123!", idempotencyKey: "start-key",
    })).rejects.toMatchObject({ code: "AUTH_VERIFICATION_FAILED" });
  });

  it("marks delivery failure without silently accepting the onboarding start", async () => {
    const transaction = {
      user: { create: vi.fn(async () => ({ id: "user-1" })) },
      userCredential: { create: vi.fn(async () => ({})) },
      otpCode: { create: vi.fn(async () => ({})) },
    };
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const client = {
      otpCode: { findUnique: vi.fn(async () => null), updateMany },
      user: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const onboarding = createWorkerInvitationIdentityOnboarding(onboardingDependencies(
      vi.fn(async () => { throw new Error("synthetic email failure"); }),
    ) as never);
    await expect(onboarding.startNewUser({
      invitationId: "invitation-1", invitationVersion: 1, fixedEmailNormalized: "worker@example.invalid",
      password: "Strong-Worker-Password-123!", idempotencyKey: "start-key",
    })).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELIVERY_FAILED" }) }));
  });

  it("consumes an active OTP once and creates the verification-only session capability", async () => {
    const challenge = {
      id: "challenge-1", userId: "user-1", status: "ACTIVE", purpose: "WORKER_INVITATION_EMAIL_VERIFICATION",
      accountCategory: null, expiresAt: new Date(now.getTime() + 60_000), destinationHash: "destination-hash",
      codeVerifier: "challenge-1:WORKER_INVITATION_EMAIL_VERIFICATION:123456", attemptCount: 0, maxAttempts: 5,
    };
    const transaction = {
      otpCode: { updateMany: vi.fn(async () => ({ count: 1 })) },
      user: { update: vi.fn(async () => ({})) },
      userSession: { create: vi.fn(async () => ({})), update: vi.fn(async () => ({})) },
    };
    const client = {
      otpCode: { findUnique: vi.fn(async () => challenge), update: vi.fn(async () => ({})) },
      user: { findUnique: vi.fn(async () => ({ id: "user-1", emailNormalized: "worker@example.invalid", status: "ACTIVE" })) },
      userCredential: { findUnique: vi.fn(async () => ({ credentialVersion: 4 })) },
      userSession: { findUnique: vi.fn(async () => null) },
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown) => work(transaction)),
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const dependencies = onboardingDependencies();
    const onboarding = createWorkerInvitationIdentityOnboarding(dependencies as never);
    const result = await onboarding.verifyEmail({
      invitationId: "invitation-1", invitationVersion: 1, fixedEmailNormalized: "worker@example.invalid",
      challengeId: "challenge-1", code: "123456", idempotencyKey: "verify-key",
    });
    expect(result).toMatchObject({
      principal: { userId: "user-1", verificationOnly: true, invitationOnboardingOnly: true },
      capability: "WORKER_INVITATION_ONBOARDING",
      allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"],
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(transaction.otpCode.updateMany).toHaveBeenCalled();
    expect(transaction.userSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ capability: "VERIFICATION_ONLY", authenticationMethod: "PASSWORD" }),
    }));
  });

  it("rejects incorrect OTPs, increments attempts, and validates consumed-session replay ownership", async () => {
    const challenge = {
      id: "challenge-1", userId: "user-1", status: "ACTIVE", purpose: "WORKER_INVITATION_EMAIL_VERIFICATION",
      accountCategory: null, expiresAt: new Date(now.getTime() + 60_000), destinationHash: "destination-hash",
      codeVerifier: "different-code", attemptCount: 4, maxAttempts: 5,
    };
    const update = vi.fn(async () => ({}));
    const client = {
      otpCode: { findUnique: vi.fn(async () => challenge), update },
      user: { findUnique: vi.fn(async () => ({ id: "user-1", emailNormalized: "worker@example.invalid", status: "ACTIVE" })) },
      userSession: { findUnique: vi.fn(async () => null) },
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const onboarding = createWorkerInvitationIdentityOnboarding(onboardingDependencies() as never);
    await expect(onboarding.verifyEmail({
      invitationId: "invitation-1", invitationVersion: 1, fixedEmailNormalized: "worker@example.invalid",
      challengeId: "challenge-1", code: "123456", idempotencyKey: "verify-key",
    })).rejects.toMatchObject({ code: "AUTH_VERIFICATION_FAILED" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "EXHAUSTED" }) }));

    (client.otpCode.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...challenge, status: "CONSUMED", codeVerifier: "challenge-1:WORKER_INVITATION_EMAIL_VERIFICATION:123456" });
    await expect(onboarding.verifyEmail({
      invitationId: "invitation-1", invitationVersion: 1, fixedEmailNormalized: "worker@example.invalid",
      challengeId: "challenge-1", code: "123456", idempotencyKey: "verify-key",
    })).rejects.toMatchObject({ code: "AUTH_VERIFICATION_FAILED" });
  });

  it("reads Worker identity/locale and reconciles Worker, Supervisor, and Admin global roles", async () => {
    const user = { id: "user-1", status: "ACTIVE", emailNormalized: "worker@example.invalid" };
    const db = {
      user: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(user)
          .mockResolvedValueOnce({ userPreferences: { language: "EN" } })
          .mockResolvedValueOnce(user)
          .mockResolvedValueOnce({ userPreferences: null }),
      },
      userRole: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ role: { code: "worker" } }, { role: { code: "provider_supervisor" } }])
          .mockResolvedValueOnce([]),
        findUnique: vi.fn(),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
      role: { findUnique: vi.fn(async ({ where }: { where: { code: string } }) => ({ id: `role-${where.code}` })) },
      sensitiveActionProofUse: { findFirst: vi.fn(async () => ({ id: "proof-use-1" })) },
    };
    const reader = new PrismaWorkerIdentityReader(db as never);
    await expect(reader.getIdentity("user-1")).resolves.toMatchObject({
      workerRoleEnabled: true, providerSupervisorRoleEnabled: true, preferredLanguage: "EN",
    });
    await expect(reader.findByEmailNormalized("worker@example.invalid")).resolves.toMatchObject({
      workerRoleEnabled: false, providerSupervisorRoleEnabled: false, preferredLanguage: null,
    });

    const writer = new PrismaWorkerIdentityAuthorityWriter(db as never);
    db.userRole.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "grant-2", status: "DISABLED" })
      .mockResolvedValueOnce({ id: "grant-3", status: "ENABLED" });
    await writer.reconcileWorkerRole({ userId: "user-1", shouldBeEnabled: true });
    await writer.reconcileProviderSupervisorRole({ userId: "user-1", shouldBeEnabled: true });
    await writer.reconcileProviderAdminRole({ userId: "user-1", shouldBeEnabled: false });
    expect(db.userRole.create).toHaveBeenCalledTimes(1);
    expect(db.userRole.update).toHaveBeenCalledTimes(2);
  });

  it("scopes recent-proof consumption and exposes transaction-bound factories", async () => {
    const findFirst = vi.fn(async () => ({ id: "proof-use-1" }));
    const transaction = {
      user: { findUnique: vi.fn() }, userRole: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      role: { findUnique: vi.fn() }, sensitiveActionProofUse: { findFirst },
    };
    const authorizer = new PrismaWorkerProofUseAuthorizer(transaction as never);
    await expect(authorizer.assertConsumed({
      proofId: "proof-1", actorUserId: "owner-1", purpose: "WORKER_REMOVE",
      providerId: "provider-1", workerId: "worker-1", requestId: "request-1",
      maximumAgeSeconds: 600, now,
    })).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        actorUserId: "owner-1", purpose: "WORKER_REMOVE", providerId: "provider-1",
        destinationVersionId: "worker-1", requestId: "request-1",
        authenticatedAt: { gte: new Date(now.getTime() - 600_000), lte: now },
      }),
      select: { id: true },
    });
    expect(createPrismaWorkerIdentityReaderFactory(transaction as never)).toBeInstanceOf(PrismaWorkerIdentityReader);
    expect(createPrismaWorkerIdentityAuthorityWriterFactory(transaction as never)).toBeInstanceOf(PrismaWorkerIdentityAuthorityWriter);
    expect(createPrismaWorkerProofUseAuthorizerFactory(transaction as never)).toBeInstanceOf(PrismaWorkerProofUseAuthorizer);
  });
});
