import type {
  AuthenticationPrincipal,
  TransactionalWorkerIdentityAuthorityWriter,
  TransactionalWorkerProofUseAuthorizer,
  WorkerIdentityReader,
  WorkerInvitationIdentityOnboarding,
  WorkerRecentAuthenticationProofVerifier,
} from "../../src/modules/authentication/authentication.public.js";
import type {
  TransactionalWorkerAvatarAuthorizer,
  WorkerAvatarPort,
} from "../../src/modules/media/media.public.js";

/** Contract fakes are deterministic and perform no SMTP or Cloudinary I/O. */
export class R1P07IdentityReaderFake implements WorkerIdentityReader {
  public identities = new Map<string, Awaited<ReturnType<WorkerIdentityReader["getIdentity"]>>>();

  public async getIdentity(userId: string) {
    return this.identities.get(userId) ?? null;
  }

  public async findByEmailNormalized(emailNormalized: string) {
    return [...this.identities.values()].find(
      (identity) => identity?.emailNormalized === emailNormalized,
    ) ?? null;
  }
}

export class R1P07IdentityAuthorityWriterFake
  implements TransactionalWorkerIdentityAuthorityWriter
{
  public readonly reconciliations: Array<Readonly<Record<string, unknown>>> = [];

  public async reconcileWorkerRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }) {
    this.reconciliations.push({ kind: "WORKER", ...input });
  }

  public async reconcileProviderSupervisorRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }) {
    this.reconciliations.push({ kind: "PROVIDER_SUPERVISOR", ...input });
  }

  public async reconcileProviderAdminRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }) {
    this.reconciliations.push({ kind: "PROVIDER_ADMIN", ...input });
  }
}

export class R1P07ProofVerifierFake implements WorkerRecentAuthenticationProofVerifier {
  public accepted = true;

  public async verify() {
    if (!this.accepted) throw new Error("WORKFORCE_REAUTHENTICATION_REQUIRED");
    return {
      proofId: "r1p07-synthetic-proof-id",
      authenticatedAt: new Date("2026-08-22T08:55:00.000Z"),
      expiresAt: new Date("2026-08-22T09:05:00.000Z"),
    };
  }
}

export class R1P07ProofUseAuthorizerFake implements TransactionalWorkerProofUseAuthorizer {
  public accepted = true;
  public async assertConsumed() { return this.accepted; }
}

export class R1P07InvitationOnboardingFake implements WorkerInvitationIdentityOnboarding {
  public async startNewUser() {
    return {
      userId: "r1p07-onboarding-user",
      challengeId: "r1p07-onboarding-challenge",
      maskedDestination: "r***@example.invalid",
      expiresAt: new Date("2026-08-22T09:10:00.000Z"),
    };
  }

  public async verifyEmail(): Promise<{
    readonly principal: AuthenticationPrincipal;
    readonly capability: "WORKER_INVITATION_ONBOARDING";
    readonly emailNormalized: string;
    readonly allowedActions: readonly ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"];
    readonly accessToken: string;
    readonly accessExpiresAt: Date;
    readonly refreshToken: string;
    readonly refreshExpiresAt: Date;
  }> {
    return {
      principal: {
        userId: "r1p07-onboarding-user",
        sessionId: "r1p07-onboarding-session",
        status: "ACTIVE",
        accountCategories: ["WORKER"],
        verifiedCategories: ["WORKER"],
        pendingCategories: [],
        verificationOnly: true,
        invitationOnboardingOnly: true,
      },
      emailNormalized: "worker@example.invalid",
      capability: "WORKER_INVITATION_ONBOARDING",
      allowedActions: ["WORKER_INVITATION_ACCEPT", "SESSION_CLEANUP"],
      accessToken: "synthetic-worker-onboarding-access",
      accessExpiresAt: new Date("2026-08-22T09:05:00.000Z"),
      refreshToken: "synthetic-worker-onboarding-refresh",
      refreshExpiresAt: new Date("2026-08-29T09:00:00.000Z"),
    };
  }
}

export class R1P07WorkerAvatarPortFake implements WorkerAvatarPort {
  public readonly cleanupRequests: Array<Readonly<Record<string, string>>> = [];
  public async ingest(input: { readonly ownerUserId: string; readonly declaredContentType: string; readonly bytes: Buffer }) {
    return {
      mediaFileId: "r1p07-avatar-media",
      ownerUserId: input.ownerUserId,
      state: "READY" as const,
      canonicalContentType: "image/webp" as const,
      byteSize: input.bytes.length,
      width: 320,
      height: 320,
      safeReceiptId: "r1p07-avatar-receipt",
    };
  }
  public async readValidationReceipt() { return null; }
  public async issuePrivateDelivery() {
    return {
      url: "https://example.invalid/private/r1p07-avatar",
      expiresAt: new Date("2026-08-22T09:05:00.000Z"),
    };
  }
  public async requestCleanup(input: { readonly mediaFileId: string; readonly safeReasonCode: string }) {
    this.cleanupRequests.push(input);
  }
}

export class R1P07AvatarAuthorizerFake implements TransactionalWorkerAvatarAuthorizer {
  public accepted = true;
  public async assertReadyOwnedProfileImage() { return this.accepted; }
}

export class R1P07AuditWriterFake {
  public readonly entries: Array<Readonly<Record<string, unknown>>> = [];
  public async append(input: Readonly<Record<string, unknown>>) {
    this.entries.push(input);
    return { auditLogId: `r1p07-audit-${this.entries.length}` };
  }
}

export class R1P07NotificationDeliveryFake {
  public fail = false;
  public readonly deliveries: Array<Readonly<Record<string, unknown>>> = [];
  public async deliver(input: Readonly<Record<string, unknown>>) {
    this.deliveries.push(input);
    if (this.fail) throw new Error("SYNTHETIC_SMTP_FAILURE");
  }
}
