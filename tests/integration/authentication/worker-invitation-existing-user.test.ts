
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";
import { ProviderWorkforceInvitationAcceptanceService } from "../../../src/modules/providers/provider-workforce-invitation-acceptance.service.js";

const now = new Date("2026-08-22T13:00:00.000Z");
const invitation: WorkerInvitationSnapshot = {
  id: "invitation-1",
  workerId: "worker-1",
  invitationVersion: 2,
  emailNormalized: "customer@example.invalid",
  locale: "EN",
  status: "PENDING",
  version: 4,
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
  id: "worker-1",
  providerId: "provider-1",
  identityUserId: null,
  predecessorWorkerId: null,
  status: "DRAFT",
  version: 5,
  acceptedInvitationLocale: null,
  endedAt: null,
  profile: {
    fullLegalName: "Existing Customer",
    gender: "FEMALE",
    operationalPhoneE164: "+201000000001",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: false,
    skills: [],
    avatarMediaFileId: null,
    version: 1,
  },
  access: { status: "INVITED", version: 3, currentInvitationId: invitation.id },
};
const principal: AuthenticationPrincipal = {
  userId: "customer-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

function createHarness(options: {
  readonly invitation?: WorkerInvitationSnapshot;
  readonly identityEmail?: string;
  readonly currentClaim?: WorkerSnapshot | null;
  readonly predecessor?: WorkerSnapshot | null;
  readonly replay?: boolean;
  readonly supervisorAssignments?: number;
} = {}) {
  const currentInvitation = options.invitation ?? invitation;
  const proofAdapter = new HmacWorkerInvitationProofAdapter(
    "r1-p07-synthetic-auth-verifier-secret-32-bytes-minimum",
  );
  const acceptedWorker: WorkerSnapshot = {
    ...worker,
    identityUserId: principal.userId,
    predecessorWorkerId: options.predecessor?.id ?? null,
    version: 6,
    acceptedInvitationLocale: currentInvitation.locale,
    profile: { ...worker.profile, operationalPhoneE164: "+201011111111", version: 2 },
    access: { status: "ACTIVE", version: 4, currentInvitationId: currentInvitation.id },
  };
  const acceptInvitation = vi.fn(async () => ({
    worker: acceptedWorker,
    invitation: {
      ...currentInvitation,
      status: "ACCEPTED" as const,
      version: currentInvitation.version + 1,
      acceptedByUserId: principal.userId,
      acceptedAt: now,
    },
  }));
  const transitionInvitation = vi.fn(async () => ({
    worker: {
      ...worker,
      access: { status: "EXPIRED" as const, version: 4, currentInvitationId: currentInvitation.id },
    },
    invitation: {
      ...currentInvitation,
      status: "EXPIRED" as const,
      version: currentInvitation.version + 1,
      expiredAt: now,
    },
  }));
  const reconcileWorkerRole = vi.fn(async () => undefined);
  const reconcileProviderSupervisorRole = vi.fn(async () => undefined);
  const appendHistory = vi.fn(async () => ({ id: `history-${appendHistory.mock.calls.length}` }));
  const appendAudit = vi.fn(async () => ({ id: "audit-1", createdAt: now.toISOString() }));
  const insertNotification = vi.fn(async () => undefined);
  const replayResult = {
    outcomeCode: "WORKER_INVITATION_ACCEPTED",
    targetId: worker.id,
    version: 6,
    impacts: [],
  };
  const context = {
    workforce: {
      getWorkerForInvitation: vi.fn(async () => worker),
      lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 1 })),
      lockWorker: vi.fn(async () => worker),
      getInvitation: vi.fn(async () => currentInvitation),
      getLatestInvitation: vi.fn(async () => currentInvitation),
      getCurrentWorkerByIdentity: vi.fn(async () => options.currentClaim ?? null),
      getLatestRemovedWorkerByIdentity: vi.fn(async () => options.predecessor ?? null),
      getWorker: vi.fn(async () => acceptedWorker),
      transitionInvitation,
      acceptInvitation,
      countPrimarySupervisorAssignments: vi.fn(async () => options.supervisorAssignments ?? 0),
    },
    commands: {
      begin: vi.fn(async () => options.replay === true
        ? ({ replay: true, result: replayResult })
        : ({ replay: false, result: null })),
      accept: vi.fn(async () => undefined),
    },
    identityReader: {
      getIdentity: vi.fn(async () => ({
        userId: principal.userId,
        status: "ACTIVE" as const,
        isAccountActive: true,
        emailNormalized: options.identityEmail ?? currentInvitation.emailNormalized,
        workerRoleEnabled: false,
        providerSupervisorRoleEnabled: false,
        preferredLanguage: "AR" as const,
      })),
    },
    identityAuthority: { reconcileWorkerRole, reconcileProviderSupervisorRole },
    history: { append: appendHistory },
    audit: { append: appendAudit },
    notifications: { insert: insertNotification },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
    run: async (callback) => callback(context),
  };
  const service = new ProviderWorkforceInvitationAcceptanceService({
    unitOfWork,
    invitationProof: proofAdapter,
    now: () => now,
  });
  const invitationProof = proofAdapter.issue({
    invitationId: currentInvitation.id,
    invitationVersion: currentInvitation.invitationVersion,
    emailNormalized: currentInvitation.emailNormalized,
    locale: currentInvitation.locale,
    expiresAt: currentInvitation.expiresAt,
  });
  return {
    service,
    invitationProof,
    context,
    acceptInvitation,
    transitionInvitation,
    reconcileWorkerRole,
    reconcileProviderSupervisorRole,
    appendHistory,
    appendAudit,
    insertNotification,
  };
}

const command = (invitationProof: string) => ({
  principal,
  invitationProof,
  requestId: "00000000-0000-4000-8000-000000000201",
  idempotencyKey: "00000000-0000-4000-8000-000000000202",
  expectedVersion: 4,
  expectedWorkerVersion: 5,
  expectedAccessVersion: 3,
  operationalPhoneE164: "+201011111111",
});

describe("existing Customer accepts a Worker invitation", () => {
  it("atomically links the exact identity, activates access, preserves Customer truth, and emits safe evidence", async () => {
    const harness = createHarness();
    const result = await harness.service.accept(command(harness.invitationProof));
    expect(result).toMatchObject({
      viewScope: "SELF",
      operationalPhoneE164: "+201011111111",
      loginAccessStatus: "ACTIVE",
    });
    expect(harness.acceptInvitation).toHaveBeenCalledWith(expect.objectContaining({
      identityUserId: principal.userId,
      operationalPhoneE164: "+201011111111",
      acceptedLocale: "EN",
      predecessorWorkerId: null,
    }));
    expect(harness.reconcileWorkerRole).toHaveBeenCalledWith({
      userId: principal.userId,
      shouldBeEnabled: true,
    });
    expect(harness.reconcileProviderSupervisorRole).toHaveBeenCalledWith({
      userId: principal.userId,
      shouldBeEnabled: false,
    });
    expect(principal.accountCategories).toEqual(["INDIVIDUAL"]);
    expect(harness.appendHistory).toHaveBeenCalledTimes(4);
    expect(harness.appendAudit).toHaveBeenCalledTimes(1);
    expect(harness.insertNotification).toHaveBeenCalledWith(expect.objectContaining({
      template: "LOGIN_ACCESS_ACTIVATED",
      locale: "AR",
      recipientUserId: principal.userId,
    }));
    const safeEvidence = JSON.stringify([
      harness.appendHistory.mock.calls,
      harness.appendAudit.mock.calls,
      harness.insertNotification.mock.calls,
    ]);
    expect(safeEvidence).not.toContain("+201011111111");
    expect(safeEvidence).not.toContain(harness.invitationProof);
    expect(safeEvidence).not.toContain(invitation.emailNormalized);
  });

  it("enables Supervisor authority when a pre-account primary assignment becomes identity-linked", async () => {
    const harness = createHarness({ supervisorAssignments: 1 });
    await harness.service.accept(command(harness.invitationProof));
    expect(harness.reconcileProviderSupervisorRole).toHaveBeenCalledWith({
      userId: principal.userId,
      shouldBeEnabled: true,
    });
  });

  it("rejects a mismatched identity email and a competing current engagement with zero writes", async () => {
    const emailMismatch = createHarness({ identityEmail: "other@example.invalid" });
    await expect(emailMismatch.service.accept(command(emailMismatch.invitationProof)))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    expect(emailMismatch.acceptInvitation).not.toHaveBeenCalled();

    const competing = createHarness({ currentClaim: { ...worker, id: "other-worker", providerId: "other-provider" } });
    await expect(competing.service.accept(command(competing.invitationProof)))
      .rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    expect(competing.acceptInvitation).not.toHaveBeenCalled();
  });

  it("settles due expiry atomically and rejects terminal/tampered proofs without identity or role changes", async () => {
    const expired = createHarness({ invitation: { ...invitation, expiresAt: now } });
    await expect(expired.service.accept(command(expired.invitationProof)))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    expect(expired.acceptInvitation).not.toHaveBeenCalled();
    expect(expired.reconcileWorkerRole).not.toHaveBeenCalled();
    expect(expired.transitionInvitation).toHaveBeenCalledWith(expect.objectContaining({
      status: "EXPIRED",
      expectedInvitationVersion: invitation.version,
      expectedAccessVersion: worker.access?.version,
    }));
    expect(expired.appendHistory).toHaveBeenCalledTimes(2);

    const revoked = createHarness({ invitation: { ...invitation, status: "REVOKED", revokedAt: now } });
    await expect(revoked.service.accept(command(revoked.invitationProof)))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    expect(revoked.acceptInvitation).not.toHaveBeenCalled();
    expect(revoked.transitionInvitation).not.toHaveBeenCalled();

    const tampered = createHarness();
    await expect(tampered.service.accept(command(`${tampered.invitationProof}x`)))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    expect(tampered.acceptInvitation).not.toHaveBeenCalled();
    expect(tampered.transitionInvitation).not.toHaveBeenCalled();
  });
});
