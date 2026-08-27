import { readFile } from "node:fs/promises";
import { join } from "node:path";


import type { WorkerInvitationIdentityOnboarding } from "../../../src/modules/authentication/authentication.public.js";
import { resolveAuthenticatedCapability } from "../../../src/modules/authentication/domain/auth.policy.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";
import { ProviderWorkforceOnboardingService } from "../../../src/modules/providers/provider-workforce-onboarding.service.js";

const now = new Date("2026-08-22T14:00:00.000Z");
const invitation: WorkerInvitationSnapshot = {
  id: "invitation-new-user",
  workerId: "worker-new-user",
  invitationVersion: 1,
  emailNormalized: "new.worker@example.invalid",
  locale: "AR",
  status: "PENDING",
  version: 2,
  issuedByUserId: "owner-1",
  acceptedByUserId: null,
  issuedAt: new Date(now.getTime() - 60_000),
  expiresAt: new Date(now.getTime() + 60_000),
  acceptedAt: null,
  revokedAt: null,
  expiredAt: null,
  supersededAt: null,
};
const worker: WorkerSnapshot = {
  id: invitation.workerId,
  providerId: "provider-1",
  identityUserId: null,
  predecessorWorkerId: null,
  status: "DRAFT",
  version: 3,
  acceptedInvitationLocale: null,
  endedAt: null,
  profile: {
    fullLegalName: "New Worker",
    gender: "MALE",
    operationalPhoneE164: "+201000000001",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: false,
    skills: [],
    avatarMediaFileId: null,
    version: 1,
  },
  access: { status: "INVITED", version: 1, currentInvitationId: invitation.id },
};

function createHarness() {
  const proof = new HmacWorkerInvitationProofAdapter(
    "r1-p07-synthetic-auth-verifier-secret-32-bytes-minimum",
  );
  const startNewUser = vi.fn(async () => ({
    userId: "new-user-1",
    challengeId: "challenge-1",
    maskedDestination: "n***@example.invalid",
    expiresAt: new Date(now.getTime() + 10 * 60_000),
  }));
  const verifyEmail = vi.fn(async () => ({
    principal: {
      userId: "new-user-1",
      sessionId: "restricted-session-1",
      accountCategories: [],
      verifiedCategories: [],
      pendingCategories: [],
      status: "ACTIVE" as const,
      verificationOnly: true,
      invitationOnboardingOnly: true,
    },
    emailNormalized: invitation.emailNormalized,
    capability: "WORKER_INVITATION_ONBOARDING" as const,
    allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"] as const,
    accessToken: "synthetic-access-token",
    accessExpiresAt: new Date(now.getTime() + 5 * 60_000),
    refreshToken: "synthetic-refresh-token",
    refreshExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
  }));
  const onboarding: WorkerInvitationIdentityOnboarding = { startNewUser, verifyEmail };
  const context = {
    workforce: {
      getWorkerForInvitation: vi.fn(async () => worker),
      lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 1 })),
      lockWorker: vi.fn(async () => worker),
      getInvitation: vi.fn(async () => invitation),
      getLatestInvitation: vi.fn(async () => invitation),
    },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  const service = new ProviderWorkforceOnboardingService({
    unitOfWork,
    invitationProof: proof,
    onboarding,
    now: () => now,
  });
  const invitationProof = proof.issue({
    invitationId: invitation.id,
    invitationVersion: invitation.invitationVersion,
    emailNormalized: invitation.emailNormalized,
    locale: invitation.locale,
    expiresAt: invitation.expiresAt,
  });
  return { service, invitationProof, startNewUser, verifyEmail };
}

describe("new-user Worker invitation onboarding", () => {
  it("binds password/OTP work to the latest fixed invitation email and returns the safe challenge", async () => {
    const harness = createHarness();
    const result = await harness.service.start({
      invitationProof: harness.invitationProof,
      password: "Synthetic-Strong-Password-123!",
      expectedVersion: invitation.version,
      idempotencyKey: "00000000-0000-4000-8000-000000000301",
    });
    expect(result).toEqual({
      challengeId: "challenge-1",
      maskedDestination: "n***@example.invalid",
      expiresAt: new Date(now.getTime() + 10 * 60_000),
    });
    expect(harness.startNewUser).toHaveBeenCalledWith(expect.objectContaining({
      invitationId: invitation.id,
      invitationVersion: invitation.invitationVersion,
      fixedEmailNormalized: invitation.emailNormalized,
    }));
    expect(JSON.stringify(result)).not.toContain(invitation.emailNormalized);
  });

  it("returns the exact purpose-restricted token handoff after fixed-email verification", async () => {
    const harness = createHarness();
    const result = await harness.service.verifyEmail({
      invitationProof: harness.invitationProof,
      challengeId: "challenge-1",
      code: "123456",
      expectedVersion: invitation.version,
      idempotencyKey: "00000000-0000-4000-8000-000000000302",
    });
    expect(result).toMatchObject({
      emailNormalized: invitation.emailNormalized,
      capability: "WORKER_INVITATION_ONBOARDING",
      allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"],
      accessToken: "synthetic-access-token",
      refreshToken: "synthetic-refresh-token",
    });
    expect(result.principal).toMatchObject({ verificationOnly: true, invitationOnboardingOnly: true });
  });

  it("keeps Authentication Worker onboarding Provider-free and makes a Worker role sufficient for FULL login", async () => {
    const source = await readFile(join(
      process.cwd(),
      "src/modules/authentication/infrastructure/prisma-worker-invitation-onboarding.ts",
    ), "utf8");
    expect(source).not.toMatch(/modules\/providers/u);
    expect(source).toMatch(/WORKER_INVITATION_EMAIL_VERIFICATION/u);
    expect(source).toMatch(/accountCategories:\s*\[\]/u);
    expect(source).not.toMatch(/phoneE164/u);
    expect(resolveAuthenticatedCapability({
      id: "new-user-1",
      phoneE164: null,
      emailNormalized: invitation.emailNormalized,
      accountCategories: [],
      verifiedCategories: [],
      status: "ACTIVE",
      suspendedUntil: null,
      phoneVerifiedAt: null,
      emailVerifiedAt: now,
    }, { workerEnabled: true })).toBe("FULL");
  });
});
