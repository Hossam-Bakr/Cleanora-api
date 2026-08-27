import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";
import { ProviderWorkforceInvitationAcceptanceService } from "../../../src/modules/providers/provider-workforce-invitation-acceptance.service.js";

const now = new Date("2026-08-23T12:00:00.000Z");
const principal: AuthenticationPrincipal = {
  userId: "worker-user-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};
const invitation: WorkerInvitationSnapshot = {
  id: "invitation-expired-1",
  workerId: "worker-1",
  invitationVersion: 1,
  emailNormalized: "worker@example.invalid",
  locale: "EN",
  status: "PENDING",
  version: 3,
  issuedByUserId: "owner-1",
  acceptedByUserId: null,
  issuedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000 - 1),
  expiresAt: new Date(now.getTime() - 1),
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
  version: 4,
  acceptedInvitationLocale: null,
  endedAt: null,
  profile: {
    fullLegalName: "Synthetic Worker",
    gender: "FEMALE",
    operationalPhoneE164: "+201000000001",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: false,
    skills: [],
    avatarMediaFileId: null,
    version: 1,
  },
  access: { status: "INVITED", version: 2, currentInvitationId: invitation.id },
};

describe("Worker invitation acceptance expiry settlement", () => {
  it("atomically expires the current invitation/access with safe history before rejecting acceptance", async () => {
    const transitioned = {
      worker: { ...worker, access: { status: "EXPIRED" as const, version: 3, currentInvitationId: invitation.id } },
      invitation: { ...invitation, status: "EXPIRED" as const, version: 4, expiredAt: now },
    };
    const transitionInvitation = vi.fn(async () => transitioned);
    const appendHistory = vi.fn(async () => ({ id: `history-${appendHistory.mock.calls.length + 1}` }));
    const commandsBegin = vi.fn(async () => ({ replay: false as const, result: null }));
    const acceptInvitation = vi.fn();
    const context = {
      workforce: {
        getWorkerForInvitation: vi.fn(async () => worker),
        lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 1 })),
        lockWorker: vi.fn(async () => worker),
        getInvitation: vi.fn(async () => invitation),
        getLatestInvitation: vi.fn(async () => invitation),
        transitionInvitation,
        acceptInvitation,
      },
      history: { append: appendHistory },
      commands: { begin: commandsBegin, accept: vi.fn() },
    } as unknown as ProvidersWorkforceTransactionContext;
    const unitOfWorkRun = vi.fn();
    const completedUnitOfWork = vi.fn();
    const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
      async run<T>(callback: (value: ProvidersWorkforceTransactionContext) => Promise<T>): Promise<T> {
        unitOfWorkRun();
        const result = await callback(context);
        completedUnitOfWork();
        return result;
      },
    };
    const proof = new HmacWorkerInvitationProofAdapter("r1-p07-synthetic-expiry-secret-is-at-least-32-bytes");
    const service = new ProviderWorkforceInvitationAcceptanceService({ unitOfWork, invitationProof: proof, now: () => now });
    const invitationProof = proof.issue({
      invitationId: invitation.id,
      invitationVersion: invitation.invitationVersion,
      emailNormalized: invitation.emailNormalized,
      locale: invitation.locale,
      expiresAt: invitation.expiresAt,
    });

    await expect(service.accept({
      principal,
      invitationProof,
      requestId: "00000000-0000-4000-8000-000000000311",
      idempotencyKey: "00000000-0000-4000-8000-000000000312",
      expectedVersion: invitation.version,
      expectedWorkerVersion: worker.version,
      expectedAccessVersion: worker.access?.version ?? 2,
      operationalPhoneE164: "+201011111111",
    })).rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });

    expect(transitionInvitation).toHaveBeenCalledWith(expect.objectContaining({
      invitationId: invitation.id,
      expectedInvitationVersion: invitation.version,
      expectedAccessVersion: worker.access?.version,
      status: "EXPIRED",
      transitionedAt: now,
    }));
    expect(appendHistory).toHaveBeenCalledTimes(2);
    expect(appendHistory).toHaveBeenCalledWith(expect.objectContaining({
      targetType: "INVITATION",
      eventCode: "WORKER_INVITATION_EXPIRED",
      actorUserId: principal.userId,
      safeBefore: { status: "PENDING", version: 3 },
      safeAfter: { status: "EXPIRED", version: 4 },
    }));
    expect(appendHistory).toHaveBeenCalledWith(expect.objectContaining({
      targetType: "LOGIN_ACCESS",
      eventCode: "WORKER_LOGIN_ACCESS_EXPIRED",
      safeBefore: { status: "INVITED", version: 2 },
      safeAfter: { status: "EXPIRED", version: 3 },
    }));
    expect(commandsBegin).not.toHaveBeenCalled();
    expect(acceptInvitation).not.toHaveBeenCalled();
    expect(unitOfWorkRun).toHaveBeenCalledTimes(1);
    expect(completedUnitOfWork).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(appendHistory.mock.calls)).not.toContain(invitation.emailNormalized);
    expect(JSON.stringify(appendHistory.mock.calls)).not.toContain("+201011111111");
  });
});
