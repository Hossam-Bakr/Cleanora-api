
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";
import { ProviderWorkforceInvitationAcceptanceService } from "../../../src/modules/providers/provider-workforce-invitation-acceptance.service.js";

const now = new Date("2026-08-23T08:00:00.000Z");
const principal: AuthenticationPrincipal = {
  userId: "worker-user-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

function snapshot(input: Partial<WorkerSnapshot> & Pick<WorkerSnapshot, "id" | "status">): WorkerSnapshot {
  return {
    id: input.id,
    providerId: input.providerId ?? "provider-1",
    identityUserId: input.identityUserId ?? null,
    predecessorWorkerId: input.predecessorWorkerId ?? null,
    status: input.status,
    version: input.version ?? 1,
    acceptedInvitationLocale: input.acceptedInvitationLocale ?? null,
    endedAt: input.endedAt ?? null,
    profile: input.profile ?? {
      fullLegalName: "Rehired Worker",
      gender: "FEMALE",
      operationalPhoneE164: "+201000000001",
      workerType: "CLEANING_STAFF",
      displayTitle: null,
      supervisorCapable: false,
      skills: [],
      avatarMediaFileId: null,
      version: 1,
    },
    access: input.access ?? null,
  };
}

describe("Worker linked rehire", () => {
  it("links a new accepted engagement to the latest same-Provider removed predecessor without reopening it", async () => {
    const predecessor = snapshot({
      id: "worker-removed-1",
      status: "REMOVED",
      identityUserId: principal.userId,
      version: 9,
      endedAt: new Date("2026-08-01T00:00:00.000Z"),
      access: { status: "REVOKED", version: 4, currentInvitationId: null },
    });
    const invitation: WorkerInvitationSnapshot = {
      id: "invitation-rehire-1",
      workerId: "worker-successor-1",
      invitationVersion: 1,
      emailNormalized: "rehire@example.invalid",
      locale: "EN",
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
    const successor = snapshot({
      id: invitation.workerId,
      status: "DRAFT",
      version: 3,
      access: { status: "INVITED", version: 1, currentInvitationId: invitation.id },
    });
    const accepted = snapshot({
      ...successor,
      identityUserId: principal.userId,
      predecessorWorkerId: predecessor.id,
      version: 4,
      acceptedInvitationLocale: "EN",
      access: { status: "ACTIVE", version: 2, currentInvitationId: invitation.id },
    });
    const acceptInvitation = vi.fn(async () => ({
      worker: accepted,
      invitation: { ...invitation, status: "ACCEPTED" as const, version: 3 },
    }));
    const appendHistory = vi.fn(async () => ({ id: `history-${appendHistory.mock.calls.length}` }));
    const context = {
      workforce: {
        getWorkerForInvitation: vi.fn(async () => successor),
        lockProvider: vi.fn(async () => ({ id: successor.providerId, workforceStateVersion: 1 })),
        lockWorker: vi.fn(async () => successor),
        getInvitation: vi.fn(async () => invitation),
        getLatestInvitation: vi.fn(async () => invitation),
        getCurrentWorkerByIdentity: vi.fn(async () => null),
        getLatestRemovedWorkerByIdentity: vi.fn(async () => predecessor),
        getWorker: vi.fn(async () => accepted),
        acceptInvitation,
        countPrimarySupervisorAssignments: vi.fn(async () => 0),
      },
      commands: {
        begin: vi.fn(async () => ({ replay: false as const, result: null })),
        accept: vi.fn(async () => undefined),
      },
      identityReader: {
        getIdentity: vi.fn(async () => ({
          userId: principal.userId,
          status: "ACTIVE" as const,
          isAccountActive: true,
          emailNormalized: invitation.emailNormalized,
          workerRoleEnabled: false,
          providerSupervisorRoleEnabled: false,
          preferredLanguage: "AR" as const,
        })),
      },
      identityAuthority: {
        reconcileWorkerRole: vi.fn(async () => undefined),
        reconcileProviderSupervisorRole: vi.fn(async () => undefined),
      },
      history: { append: appendHistory },
      audit: { append: vi.fn(async () => ({ id: "audit-1", createdAt: now.toISOString() })) },
      notifications: { insert: vi.fn(async () => undefined) },
    } as unknown as ProvidersWorkforceTransactionContext;
    const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
      run: async (callback) => callback(context),
    };
    const proof = new HmacWorkerInvitationProofAdapter(
      "r1-p07-synthetic-rehire-secret-is-at-least-32-bytes",
    );
    const service = new ProviderWorkforceInvitationAcceptanceService({ unitOfWork, invitationProof: proof, now: () => now });

    const invitationProof = proof.issue({
      invitationId: invitation.id,
      invitationVersion: invitation.invitationVersion,
      emailNormalized: invitation.emailNormalized,
      locale: invitation.locale,
      expiresAt: invitation.expiresAt,
    });
    const result = await service.accept({
      principal,
      invitationProof,
      requestId: "00000000-0000-4000-8000-000000000301",
      idempotencyKey: "00000000-0000-4000-8000-000000000302",
      expectedVersion: invitation.version,
      expectedWorkerVersion: successor.version,
      expectedAccessVersion: successor.access?.version ?? 1,
      operationalPhoneE164: "+201011111111",
    });

    expect(result.worker.workerId).toBe(successor.id);
    expect(acceptInvitation).toHaveBeenCalledWith(expect.objectContaining({
      workerId: successor.id,
      identityUserId: principal.userId,
      predecessorWorkerId: predecessor.id,
    }));
    expect(predecessor).toMatchObject({ status: "REMOVED", version: 9, endedAt: expect.any(Date) });
    expect(appendHistory).toHaveBeenCalledWith(expect.objectContaining({
      eventCode: "WORKER_REHIRED_LINKED",
      safeBefore: { predecessorWorkerId: null },
      safeAfter: { predecessorWorkerId: predecessor.id },
    }));
    const evidence = JSON.stringify(appendHistory.mock.calls);
    expect(evidence).not.toContain(invitation.emailNormalized);
    expect(evidence).not.toContain("+201011111111");
  });
});
