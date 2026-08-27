import { performance } from "node:perf_hooks";

import type { WorkerRecentAuthenticationProofVerifier } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import type { WorkerInvitationProofPort } from "../../../src/modules/providers/domain/worker-invitation-proof.policy.js";
import { ProviderWorkforceInvitationService } from "../../../src/modules/providers/provider-workforce-invitation.service.js";
import { ProviderWorkforceService } from "../../../src/modules/providers/provider-workforce.service.js";

describe("SC-001 Worker create and invitation journey timing", () => {
  it("completes the authorized business journey in under three minutes without SMTP delivery", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    let worker: WorkerSnapshot = {
      id: "worker-1", providerId: "provider-1", identityUserId: null, predecessorWorkerId: null,
      status: "DRAFT", version: 1, acceptedInvitationLocale: null, endedAt: null,
      profile: {
        fullLegalName: "Synthetic Worker", gender: "FEMALE", operationalPhoneE164: "+201012345678",
        workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false,
        skills: ["Deep Cleaning"], avatarMediaFileId: null, version: 1,
      },
      access: null,
    };
    const notificationInsert = vi.fn(async () => undefined);
    const context = {
      workforce: {
        lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
        readActorMembership: vi.fn(async () => ({ level: "OWNER" as const, active: true, version: 1 })),
        createWorker: vi.fn(async () => worker),
        getWorker: vi.fn(async () => worker),
        lockWorker: vi.fn(async () => worker),
        getLatestInvitation: vi.fn(async () => null),
        issueInvitation: vi.fn(async () => {
          const invitation: WorkerInvitationSnapshot = {
            id: "invitation-1", workerId: worker.id, invitationVersion: 1,
            emailNormalized: "worker@example.invalid", locale: "AR", status: "PENDING", version: 1,
            issuedByUserId: "owner-1", acceptedByUserId: null, issuedAt: now,
            expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000), acceptedAt: null,
            revokedAt: null, expiredAt: null, supersededAt: null,
          };
          worker = { ...worker, version: 2, access: { status: "INVITED", version: 1, currentInvitationId: invitation.id } };
          return { worker, invitation };
        }),
      },
      commands: {
        begin: vi.fn(async () => ({ replay: false, result: null })),
        accept: vi.fn(async () => undefined),
      },
      history: { append: vi.fn(async () => ({ id: "history-1" })) },
      notifications: { insert: notificationInsert },
      audit: { append: vi.fn(async () => ({ id: "audit-1", createdAt: now.toISOString() })) },
      proofUseAuthorizer: { assertConsumed: vi.fn(async () => true) },
    } as unknown as ProvidersWorkforceTransactionContext;
    const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
    const workforce = new ProviderWorkforceService({ unitOfWork, createId: () => "worker-1" });
    const recentProof: WorkerRecentAuthenticationProofVerifier = {
      verify: vi.fn(async () => ({
        proofId: "proof-1",
        authenticatedAt: new Date(now.getTime() - 60_000),
        expiresAt: new Date(now.getTime() + 60_000),
      })),
    };
    const invitationProof: WorkerInvitationProofPort = {
      issue: vi.fn(() => "routing.signature"), inspectRouting: vi.fn(() => null), verify: vi.fn(() => true),
    };
    const invitations = new ProviderWorkforceInvitationService({
      unitOfWork, recentProof, invitationProof, now: () => now, createId: () => "invitation-1",
    });

    const startedAt = performance.now();
    await workforce.createWorkerDraft({
      actorUserId: "owner-1", providerId: "provider-1",
      requestId: "00000000-0000-4000-8000-000000000171",
      idempotencyKey: "00000000-0000-4000-8000-000000000172",
      expectedVersion: 1,
      profile: {
        fullLegalName: "Synthetic Worker", gender: "female", operationalPhoneE164: "+201012345678",
        workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false,
        skillTags: ["Deep Cleaning"],
      },
    });
    const result = await invitations.issue({
      actorUserId: "owner-1", sessionId: "session-1", providerId: "provider-1", workerId: "worker-1",
      requestId: "00000000-0000-4000-8000-000000000173",
      idempotencyKey: "00000000-0000-4000-8000-000000000174",
      expectedVersion: 1, expectedAccessVersion: null,
      opaqueRecentAuthenticationProof: "opaque", email: "worker@example.invalid", locale: "AR",
    });
    const elapsedMilliseconds = performance.now() - startedAt;

    expect(result.outcomeCode).toBe("WORKER_INVITATION_ISSUED");
    expect(notificationInsert).toHaveBeenCalledTimes(1);
    expect(elapsedMilliseconds).toBeLessThan(3 * 60 * 1000);
  });
});
