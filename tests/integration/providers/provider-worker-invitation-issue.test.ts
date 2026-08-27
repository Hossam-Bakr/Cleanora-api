
import type { WorkerRecentAuthenticationProofVerifier } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import type { WorkerInvitationProofPort } from "../../../src/modules/providers/domain/worker-invitation-proof.policy.js";
import { ProviderWorkforceInvitationService } from "../../../src/modules/providers/provider-workforce-invitation.service.js";

const now = new Date("2026-08-22T10:00:00.000Z");
const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: null, predecessorWorkerId: null,
  status: "DRAFT", version: 4, acceptedInvitationLocale: null, endedAt: null,
  profile: {
    fullLegalName: "Synthetic Worker", gender: "FEMALE", operationalPhoneE164: "+201012345678",
    workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false, skills: [],
    avatarMediaFileId: null, version: 1,
  },
  access: null,
};

function createHarness(
  level: "OWNER" | "ADMIN" = "OWNER",
  proofAccepted = true,
  options: {
    readonly currentWorker?: WorkerSnapshot;
    readonly latestInvitation?: WorkerInvitationSnapshot;
    readonly replayResult?: Readonly<Record<string, unknown>>;
    readonly transactionalProofAccepted?: boolean;
  } = {},
) {
  const invitation: WorkerInvitationSnapshot = {
    id: "invitation-2", workerId: worker.id, invitationVersion: 2,
    emailNormalized: "worker@example.invalid", locale: "EN", status: "PENDING", version: 1,
    issuedByUserId: "owner-1", acceptedByUserId: null, issuedAt: now,
    expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
    acceptedAt: null, revokedAt: null, expiredAt: null, supersededAt: null,
  };
  const currentWorker = options.currentWorker ?? worker;
  const issueInvitation = vi.fn(async (input: {
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly emailNormalized: string;
    readonly locale: "AR" | "EN";
  }) => ({
    worker: {
      ...currentWorker,
      version: currentWorker.version + 1,
      access: {
        status: "INVITED" as const,
        version: (currentWorker.access?.version ?? 0) + 1,
        currentInvitationId: input.invitationId,
      },
    },
    invitation: {
      ...invitation,
      id: input.invitationId,
      invitationVersion: input.invitationVersion,
      emailNormalized: input.emailNormalized,
      locale: input.locale,
    },
  }));
  const transitionInvitation = vi.fn(async () => ({
    worker: {
      ...currentWorker,
      access: {
        status: "REVOKED" as const,
        version: (currentWorker.access?.version ?? 0) + 1,
        currentInvitationId: options.latestInvitation?.id ?? invitation.id,
      },
    },
    invitation: {
      ...(options.latestInvitation ?? invitation),
      status: "REVOKED" as const,
      version: (options.latestInvitation ?? invitation).version + 1,
      revokedAt: now,
    },
  }));
  const insertNotification = vi.fn(async () => undefined);
  const appendHistory = vi.fn(async () => ({ id: "history-1" }));
  const appendAudit = vi.fn(async () => ({ id: "audit-1", createdAt: now.toISOString() }));
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level, active: true, version: 1 })),
      lockWorker: vi.fn(async () => currentWorker),
      getLatestInvitation: vi.fn(async () => options.latestInvitation ?? ({ ...invitation, id: "invitation-1", invitationVersion: 1 })),
      issueInvitation,
      transitionInvitation,
    },
    commands: {
      begin: vi.fn(async () => options.replayResult === undefined
        ? ({ replay: false, result: null })
        : ({ replay: true, result: options.replayResult })),
      accept: vi.fn(async () => undefined),
    },
    history: { append: appendHistory },
    notifications: { insert: insertNotification },
    audit: { append: appendAudit },
    proofUseAuthorizer: {
      assertConsumed: vi.fn(async () => options.transactionalProofAccepted ?? proofAccepted),
    },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWorkRun = vi.fn();
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
    async run<T>(callback: (value: ProvidersWorkforceTransactionContext) => Promise<T>): Promise<T> {
      unitOfWorkRun();
      return callback(context);
    },
  };
  const recentProof: WorkerRecentAuthenticationProofVerifier = {
    verify: vi.fn(async () => {
      if (!proofAccepted) throw new Error("invalid proof");
      return { proofId: "proof-id", authenticatedAt: new Date(now.getTime() - 60_000), expiresAt: new Date(now.getTime() + 60_000) };
    }),
  };
  const invitationProof: WorkerInvitationProofPort = {
    issue: vi.fn(() => "routing.signature"),
    inspectRouting: vi.fn(() => null),
    verify: vi.fn(() => true),
  };
  return {
    service: new ProviderWorkforceInvitationService({
      unitOfWork, recentProof, invitationProof, now: () => now, createId: () => "invitation-2",
    }),
    recentProof,
    issueInvitation,
    transitionInvitation,
    insertNotification,
    appendHistory,
    appendAudit,
    context,
    unitOfWorkRun,
  };
}

const command = {
  actorUserId: "owner-1",
  sessionId: "session-1",
  providerId: "provider-1",
  workerId: "worker-1",
  requestId: "00000000-0000-4000-8000-000000000111",
  idempotencyKey: "00000000-0000-4000-8000-000000000112",
  expectedVersion: 4,
  expectedAccessVersion: null,
  opaqueRecentAuthenticationProof: "opaque-step-up",
  email: " WORKER@Example.Invalid ",
  locale: "EN" as const,
};

describe("Owner Worker invitation issue", () => {
  it("commits versioned invitation/access/evidence and an atomic safe intent", async () => {
    const harness = createHarness();
    const result = await harness.service.issue(command);
    expect(result).toMatchObject({ outcomeCode: "WORKER_INVITATION_ISSUED", targetId: "invitation-2", version: 1 });
    expect(harness.issueInvitation).toHaveBeenCalledWith(expect.objectContaining({
      invitationVersion: 2,
      emailNormalized: "worker@example.invalid",
      locale: "EN",
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
    }));
    expect(harness.appendHistory).toHaveBeenCalledTimes(2);
    expect(harness.appendAudit).toHaveBeenCalledTimes(1);
    expect(harness.insertNotification).toHaveBeenCalledTimes(1);
    const evidence = JSON.stringify([
      harness.appendHistory.mock.calls,
      harness.appendAudit.mock.calls,
      harness.insertNotification.mock.calls,
    ]);
    expect(evidence).not.toContain("opaque-step-up");
    expect(evidence).not.toContain("routing.signature");
    expect(evidence).not.toContain("WORKER@Example.Invalid");
  });

  it("denies Admin even when the Worker belongs to the exact Provider", async () => {
    const harness = createHarness("ADMIN");
    await expect(harness.service.issue(command)).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });
    expect(harness.issueInvitation).not.toHaveBeenCalled();
  });

  it("binds recent authentication to the exact command before opening the transaction", async () => {
    const harness = createHarness("OWNER", false);
    await expect(harness.service.issue(command)).rejects.toMatchObject({ code: "WORKFORCE_REAUTHENTICATION_REQUIRED" });
    expect(harness.recentProof.verify).toHaveBeenCalledWith(expect.objectContaining({
      principalUserId: "owner-1",
      sessionId: "session-1",
      purpose: "WORKER_ACCESS_ISSUE",
      providerId: "provider-1",
      workerId: "worker-1",
      maximumAgeSeconds: 600,
    }));
    expect(harness.unitOfWorkRun).not.toHaveBeenCalled();
    expect(harness.issueInvitation).not.toHaveBeenCalled();
  });
});

describe("Owner Worker invitation replacement and revocation", () => {
  const invitedWorker: WorkerSnapshot = {
    ...worker,
    access: { status: "EXPIRED", version: 3, currentInvitationId: "invitation-1" },
  };
  const terminalInvitation: WorkerInvitationSnapshot = {
    id: "invitation-1",
    workerId: worker.id,
    invitationVersion: 2,
    emailNormalized: "previous@example.invalid",
    locale: "AR",
    status: "EXPIRED",
    version: 4,
    issuedByUserId: "owner-1",
    acceptedByUserId: null,
    issuedAt: now,
    expiresAt: now,
    acceptedAt: null,
    revokedAt: null,
    expiredAt: now,
    supersededAt: null,
  };

  it("resends after a terminal version and binds the replacement locale/version", async () => {
    const harness = createHarness("OWNER", true, {
      currentWorker: invitedWorker,
      latestInvitation: terminalInvitation,
    });
    const result = await harness.service.resend({
      ...command,
      expectedAccessVersion: 3,
      locale: "AR",
    });
    expect(result).toMatchObject({ outcomeCode: "WORKER_INVITATION_RESENT", targetId: "invitation-2" });
    expect(harness.issueInvitation).toHaveBeenCalledWith(expect.objectContaining({
      expectedAccessVersion: 3,
      invitationVersion: 3,
      locale: "AR",
    }));
    expect(harness.insertNotification).toHaveBeenCalledTimes(1);
  });

  it("replays an accepted high-risk command only after session-bound proof verification", async () => {
    const replayResult = {
      outcomeCode: "WORKER_INVITATION_RESENT",
      targetId: "invitation-2",
      version: 1,
      impacts: [],
    };
    const harness = createHarness("OWNER", true, {
      currentWorker: invitedWorker,
      latestInvitation: terminalInvitation,
      replayResult,
      transactionalProofAccepted: false,
    });
    await expect(harness.service.resend({ ...command, expectedAccessVersion: 3 }))
      .resolves.toEqual(replayResult);
    expect(harness.recentProof.verify).toHaveBeenCalledTimes(1);
    expect(harness.context.proofUseAuthorizer.assertConsumed).not.toHaveBeenCalled();
    expect(harness.issueInvitation).not.toHaveBeenCalled();
  });

  it("records the superseded pending invitation as a separate immutable truth on resend", async () => {
    const pendingInvitation = { ...terminalInvitation, status: "PENDING" as const, expiredAt: null };
    const pendingWorker: WorkerSnapshot = {
      ...invitedWorker,
      access: { status: "INVITED", version: 3, currentInvitationId: pendingInvitation.id },
    };
    const harness = createHarness("OWNER", true, {
      currentWorker: pendingWorker,
      latestInvitation: pendingInvitation,
    });
    await expect(harness.service.resend({ ...command, expectedAccessVersion: 3 }))
      .resolves.toMatchObject({ outcomeCode: "WORKER_INVITATION_RESENT" });
    expect(harness.appendHistory).toHaveBeenCalledWith(expect.objectContaining({
      targetType: "INVITATION",
      targetId: pendingInvitation.id,
      targetVersion: pendingInvitation.version + 1,
      eventCode: "WORKER_INVITATION_SUPERSEDED",
      safeBefore: { status: "PENDING", version: pendingInvitation.version },
      safeAfter: { status: "SUPERSEDED", version: pendingInvitation.version + 1 },
    }));
    expect(harness.appendHistory).toHaveBeenCalledTimes(3);
  });

  it("revokes the latest pending invitation/access atomically with safe evidence and intent", async () => {
    const pendingInvitation = { ...terminalInvitation, status: "PENDING" as const, expiredAt: null };
    const pendingWorker: WorkerSnapshot = {
      ...invitedWorker,
      access: { status: "INVITED", version: 3, currentInvitationId: pendingInvitation.id },
    };
    const harness = createHarness("OWNER", true, {
      currentWorker: pendingWorker,
      latestInvitation: pendingInvitation,
    });
    const result = await harness.service.revoke({
      actorUserId: command.actorUserId,
      sessionId: command.sessionId,
      providerId: command.providerId,
      workerId: command.workerId,
      requestId: command.requestId,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      expectedAccessVersion: 3,
      opaqueRecentAuthenticationProof: command.opaqueRecentAuthenticationProof,
      reasonCode: "SECURITY_CONCERN",
    });
    expect(result).toMatchObject({ outcomeCode: "WORKER_INVITATION_REVOKED", targetId: pendingInvitation.id });
    expect(harness.transitionInvitation).toHaveBeenCalledWith(expect.objectContaining({
      invitationId: pendingInvitation.id,
      expectedInvitationVersion: pendingInvitation.version,
      expectedAccessVersion: 3,
      status: "REVOKED",
    }));
    expect(harness.appendHistory).toHaveBeenCalledTimes(2);
    expect(harness.appendAudit).toHaveBeenCalledTimes(1);
    expect(harness.insertNotification).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(harness.insertNotification.mock.calls)).not.toContain(command.opaqueRecentAuthenticationProof);
  });
});
