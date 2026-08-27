
import type { WorkerRecentAuthenticationProofVerifier } from "../../../src/modules/authentication/authentication.public.js";
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceLifecycleService } from "../../../src/modules/providers/provider-workforce-lifecycle.service.js";
import { ProviderWorkforceAccessService } from "../../../src/modules/providers/provider-workforce-access.service.js";
import { ProviderWorkforceAuthorityService } from "../../../src/modules/providers/provider-workforce-authority.service.js";

const now = new Date("2026-08-22T15:00:00.000Z");
const worker: WorkerSnapshot = {
  id: "worker-1",
  providerId: "provider-1",
  identityUserId: "worker-user-1",
  predecessorWorkerId: null,
  status: "ACTIVE",
  version: 4,
  acceptedInvitationLocale: "EN",
  endedAt: null,
  profile: {
    fullLegalName: "Lifecycle Worker",
    gender: "MALE",
    operationalPhoneE164: "+201011111111",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: false,
    skills: [],
    avatarMediaFileId: null,
    version: 1,
  },
  access: { status: "ACTIVE", version: 2, currentInvitationId: "invitation-1" },
};

function createHarness(level: "OWNER" | "ADMIN" = "ADMIN") {
  let current = worker;
  const setWorkerStatus = vi.fn(async (input: { readonly status: WorkerSnapshot["status"]; readonly endedAt?: Date | null }) => {
    current = { ...current, status: input.status, version: current.version + 1, endedAt: input.endedAt ?? current.endedAt };
    return current;
  });
  const setWorkerAccessStatus = vi.fn(async () => {
    current = { ...current, access: { status: "REVOKED", version: 3, currentInvitationId: "invitation-1" } };
    return current;
  });
  const updateMembership = vi.fn(async () => ({
    id: "membership-1", teamId: "team-1", workerId: worker.id, cleans: true,
    version: 2, endedAt: now, worker: current,
  }));
  const appendHistory = vi.fn(async () => ({ id: `history-${appendHistory.mock.calls.length}` }));
  const appendAudit = vi.fn(async () => ({ id: "audit-1", createdAt: now.toISOString() }));
  const insertNotification = vi.fn(async () => undefined);
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level, active: true, version: 1 })),
      lockWorker: vi.fn(async () => current),
      getWorker: vi.fn(async () => current),
      getCurrentMembershipForWorker: vi.fn(async () => null),
      listReadinessCandidates: vi.fn(async () => []),
      setWorkerStatus,
      setWorkerAccessStatus,
      updateMembership,
      countActiveAccessForIdentity: vi.fn(async () => 0),
    },
    identityReader: {
      getIdentity: vi.fn(async () => ({
        userId: "worker-user-1",
        status: "ACTIVE" as const,
        isAccountActive: true,
        emailNormalized: "worker@example.invalid",
        workerRoleEnabled: true,
        providerSupervisorRoleEnabled: false,
        preferredLanguage: "AR" as const,
      })),
    },
    identityAuthority: { reconcileWorkerRole: vi.fn(async () => undefined) },
    proofUseAuthorizer: { assertConsumed: vi.fn(async () => true) },
    commands: {
      begin: vi.fn(async () => ({ replay: false, result: null })),
      accept: vi.fn(async () => undefined),
    },
    history: { append: appendHistory },
    audit: { append: appendAudit },
    notifications: { insert: insertNotification },
  } as unknown as ProvidersWorkforceTransactionContext;
  const recentProof: WorkerRecentAuthenticationProofVerifier = {
    verify: vi.fn(async () => ({
      proofId: "proof-1",
      authenticatedAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() + 60_000),
    })),
  };
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  return {
    service: new ProviderWorkforceLifecycleService({ unitOfWork, recentProof, now: () => now }),
    context,
    recentProof,
    setWorkerStatus,
    setWorkerAccessStatus,
    updateMembership,
    appendHistory,
    appendAudit,
    insertNotification,
  };
}

const base = {
  actorUserId: "admin-1",
  sessionId: "session-1",
  providerId: "provider-1",
  workerId: "worker-1",
  requestId: "00000000-0000-4000-8000-000000000501",
  idempotencyKey: "00000000-0000-4000-8000-000000000502",
  expectedVersion: 4,
};

describe("Worker lifecycle/access authority", () => {
  it("allows exact-Provider Admin deactivation without step-up and keeps access independent", async () => {
    const harness = createHarness("ADMIN");
    const result = await harness.service.transition({
      ...base,
      action: "DEACTIVATE",
      reasonCode: "TEMPORARILY_UNAVAILABLE",
      confirmTeamImpact: false,
      confirmReadinessImpact: false,
    });
    expect(result).toMatchObject({ outcomeCode: "WORKER_DEACTIVATED", version: 5 });
    expect(harness.recentProof.verify).not.toHaveBeenCalled();
    expect(harness.setWorkerStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "INACTIVE" }));
    expect(harness.setWorkerAccessStatus).not.toHaveBeenCalled();
    expect(harness.appendHistory).toHaveBeenCalledTimes(1);
    expect(harness.appendAudit).toHaveBeenCalledTimes(1);
    expect(harness.insertNotification).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid operational transition before state or evidence changes", async () => {
    const harness = createHarness("ADMIN");
    await expect(harness.service.transition({ ...base, action: "ACTIVATE" }))
      .rejects.toMatchObject({ code: "WORKFORCE_INVALID_WORKER_TRANSITION" });
    expect(harness.setWorkerStatus).not.toHaveBeenCalled();
    expect(harness.appendHistory).not.toHaveBeenCalled();
  });

  it("allows only Owner removal with exact recent proof and atomically revokes Provider access", async () => {
    const harness = createHarness("OWNER");
    const result = await harness.service.transition({
      ...base,
      actorUserId: "owner-1",
      action: "REMOVE",
      reasonCode: "ENGAGEMENT_ENDED",
      note: "Contract ended normally",
      recentAuthenticationProof: "opaque-recent-proof",
      confirmTeamImpact: false,
      confirmReadinessImpact: false,
    });
    expect(result.outcomeCode).toBe("WORKER_REMOVED");
    expect(harness.recentProof.verify).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "WORKER_REMOVE",
      providerId: worker.providerId,
      workerId: worker.id,
    }));
    expect(harness.setWorkerStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "REMOVED", endedAt: now }));
    expect(harness.setWorkerAccessStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "REVOKED" }));
    expect(harness.context.identityAuthority.reconcileWorkerRole).toHaveBeenCalledWith({
      userId: "worker-user-1", shouldBeEnabled: false,
    });
    expect(harness.insertNotification).toHaveBeenCalledTimes(1);
  });

  it("denies Admin removal even with a valid proof", async () => {
    const harness = createHarness("ADMIN");
    await expect(harness.service.transition({
      ...base,
      action: "REMOVE",
      reasonCode: "ENGAGEMENT_ENDED",
      note: "Contract ended normally",
      recentAuthenticationProof: "opaque-recent-proof",
      confirmTeamImpact: false,
      confirmReadinessImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });
    expect(harness.setWorkerStatus).not.toHaveBeenCalled();
  });
});

function createHighRiskHarness(options: {
  readonly level?: "OWNER" | "ADMIN";
  readonly accessStatus?: "ACTIVE" | "INVITED" | "REVOKED";
  readonly adminMembership?: { readonly id: string; readonly active: boolean; readonly version: number } | null;
  readonly remainingWorkerAccess?: number;
  readonly remainingAdminMemberships?: number;
} = {}) {
  const level = options.level ?? "OWNER";
  let current: WorkerSnapshot = {
    ...worker,
    access: { status: options.accessStatus ?? "ACTIVE", version: 2, currentInvitationId: "invitation-1" },
  };
  let adminMembership = options.adminMembership === undefined
    ? null
    : options.adminMembership === null
      ? null
      : {
        ...options.adminMembership,
        providerId: worker.providerId,
        userId: worker.identityUserId!,
        level: "ADMIN" as const,
      };
  const histories: Array<Readonly<Record<string, unknown>>> = [];
  const audits: Array<Readonly<Record<string, unknown>>> = [];
  const notifications: Array<Readonly<Record<string, unknown>>> = [];
  const accepted: Array<Readonly<Record<string, unknown>>> = [];
  const identityAuthority = {
    reconcileWorkerRole: vi.fn(async () => undefined),
    reconcileProviderAdminRole: vi.fn(async () => undefined),
  };
  const issueInvitation = vi.fn(async (input: { readonly invitationId: string; readonly invitationVersion: number; readonly emailNormalized: string; readonly locale: "AR" | "EN" }) => {
    current = {
      ...current,
      version: current.version + 1,
      access: { status: "INVITED", version: 3, currentInvitationId: input.invitationId },
    };
    return {
      worker: current,
      invitation: {
        id: input.invitationId,
        workerId: current.id,
        invitationVersion: input.invitationVersion,
        emailNormalized: input.emailNormalized,
        locale: input.locale,
        status: "PENDING" as const,
        version: 1,
        issuedByUserId: "owner-1",
        acceptedByUserId: null,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        acceptedAt: null,
        revokedAt: null,
        expiredAt: null,
        supersededAt: null,
      },
    };
  });
  const setWorkerAccessStatus = vi.fn(async (input: { readonly status: "ACTIVE" | "REVOKED" }) => {
    current = { ...current, access: { status: input.status, version: 3, currentInvitationId: "invitation-1" } };
    return current;
  });
  const transitionInvitation = vi.fn(async () => {
    current = { ...current, access: { status: "REVOKED", version: 3, currentInvitationId: "invitation-1" } };
    return {
      worker: current,
      invitation: {
        id: "invitation-1", workerId: worker.id, invitationVersion: 1,
        emailNormalized: "worker@example.invalid", locale: "EN" as const,
        status: "REVOKED" as const, version: 2, issuedByUserId: "owner-1", acceptedByUserId: null,
        issuedAt: now, expiresAt: new Date(now.getTime() + 60_000), acceptedAt: null,
        revokedAt: now, expiredAt: null, supersededAt: null,
      },
    };
  });
  const setProviderAdminMembership = vi.fn(async (input: { readonly active: boolean }) => {
    adminMembership = {
      id: adminMembership?.id ?? "admin-membership-1",
      providerId: worker.providerId,
      userId: worker.identityUserId!,
      level: "ADMIN",
      active: input.active,
      version: (adminMembership?.version ?? 0) + 1,
    };
    return adminMembership;
  });
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level, active: true, version: 1 })),
      lockWorker: vi.fn(async () => current),
      getWorker: vi.fn(async () => current),
      getLatestInvitation: vi.fn(async () => ({
        id: "invitation-1", workerId: worker.id, invitationVersion: 1,
        emailNormalized: "worker@example.invalid", locale: "EN" as const,
        status: options.accessStatus === "INVITED" ? "PENDING" as const : "ACCEPTED" as const,
        version: 1, issuedByUserId: "owner-1", acceptedByUserId: worker.identityUserId,
        issuedAt: now, expiresAt: new Date(now.getTime() + 60_000), acceptedAt: now,
        revokedAt: null, expiredAt: null, supersededAt: null,
      })),
      issueInvitation,
      setWorkerAccessStatus,
      transitionInvitation,
      countActiveAccessForIdentity: vi.fn(async () => options.remainingWorkerAccess ?? 0),
      lockProviderMember: vi.fn(async () => adminMembership),
      setProviderAdminMembership,
      countActiveAdminMemberships: vi.fn(async () => options.remainingAdminMemberships ?? (adminMembership?.active === true ? 1 : 0)),
    },
    identityReader: {
      getIdentity: vi.fn(async () => ({
        userId: worker.identityUserId!, status: "ACTIVE" as const, isAccountActive: true,
        emailNormalized: "worker@example.invalid", workerRoleEnabled: true,
        providerSupervisorRoleEnabled: false, preferredLanguage: "AR" as const,
      })),
    },
    identityAuthority,
    proofUseAuthorizer: { assertConsumed: vi.fn(async () => true) },
    commands: {
      begin: vi.fn(async () => ({ replay: false, result: null })),
      accept: vi.fn(async (input) => { accepted.push(input); }),
    },
    history: { append: vi.fn(async (input) => { histories.push(input); return { id: `history-${histories.length}` }; }) },
    audit: { append: vi.fn(async (input) => { audits.push(input); return { auditLogId: `audit-${audits.length}` }; }) },
    notifications: { insert: vi.fn(async (input) => { notifications.push(input); }) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  const recentProof: WorkerRecentAuthenticationProofVerifier = {
    verify: vi.fn(async () => ({ proofId: "proof-1", authenticatedAt: new Date(now.getTime() - 1_000), expiresAt: new Date(now.getTime() + 599_000) })),
  };
  return {
    access: new ProviderWorkforceAccessService({
      unitOfWork,
      recentProof,
      invitationProof: { issue: vi.fn(() => "opaque-proof"), inspectRouting: vi.fn(() => null), verify: vi.fn(() => false) },
      now: () => now,
      createId: () => "invitation-2",
    }),
    authority: new ProviderWorkforceAuthorityService({ unitOfWork, recentProof, now: () => now }),
    context,
    recentProof,
    issueInvitation,
    setWorkerAccessStatus,
    setProviderAdminMembership,
    identityAuthority,
    histories,
    audits,
    notifications,
    accepted,
  };
}

describe("Worker login-access and Admin authority commands", () => {
  const highRiskBase = {
    actorUserId: "owner-1",
    sessionId: "session-1",
    providerId: "provider-1",
    workerId: "worker-1",
    requestId: "00000000-0000-4000-8000-000000000511",
    idempotencyKey: "00000000-0000-4000-8000-000000000512",
    expectedVersion: 4,
    recentAuthenticationProof: "opaque-proof",
  } as const;

  it("resets active access to a locale-bound invitation and disables only the projected Worker role", async () => {
    const harness = createHighRiskHarness();
    const result = await harness.access.reset({
      ...highRiskBase,
      expectedAccessVersion: 2,
      email: "WORKER@example.invalid",
      locale: "EN",
    });
    expect(result).toMatchObject({ outcomeCode: "WORKER_LOGIN_ACCESS_RESET", targetId: "invitation-2" });
    expect(harness.recentProof.verify).toHaveBeenCalledWith(expect.objectContaining({ purpose: "WORKER_ACCESS_RESET" }));
    expect(harness.issueInvitation).toHaveBeenCalledWith(expect.objectContaining({
      workerId: worker.id, expectedAccessVersion: 2, emailNormalized: "worker@example.invalid", locale: "EN",
    }));
    expect(harness.identityAuthority.reconcileWorkerRole).toHaveBeenCalledWith({ userId: "worker-user-1", shouldBeEnabled: false });
    expect(harness.histories.map((entry) => entry["targetType"])).toEqual(["INVITATION", "LOGIN_ACCESS"]);
    expect(harness.notifications).toHaveLength(1);
    expect(JSON.stringify(harness.notifications[0])).not.toContain("opaque-proof");
  });

  it("revokes accepted access, preserves the shared identity, and reconciles role across engagements", async () => {
    const harness = createHighRiskHarness({ remainingWorkerAccess: 1 });
    const result = await harness.access.revoke({
      ...highRiskBase,
      expectedAccessVersion: 2,
      reasonCode: "SECURITY_CONCERN",
    });
    expect(result.outcomeCode).toBe("WORKER_LOGIN_ACCESS_REVOKED");
    expect(harness.setWorkerAccessStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "REVOKED" }));
    expect(harness.identityAuthority.reconcileWorkerRole).toHaveBeenCalledWith({ userId: "worker-user-1", shouldBeEnabled: true });
    expect(harness.context.identityReader.getIdentity).toHaveBeenCalledWith("worker-user-1");
  });

  it("denies Admin access reset before any business write", async () => {
    const harness = createHighRiskHarness({ level: "ADMIN" });
    await expect(harness.access.reset({
      ...highRiskBase,
      expectedAccessVersion: 2,
      email: "worker@example.invalid",
      locale: "EN",
    })).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });
    expect(harness.issueInvitation).not.toHaveBeenCalled();
    expect(harness.histories).toHaveLength(0);
  });

  it("grants and revokes explicit Admin membership independently of Worker lifecycle", async () => {
    const grant = createHighRiskHarness();
    const granted = await grant.authority.change({
      ...highRiskBase,
      action: "GRANT",
      expectedMembershipVersion: null,
      reasonCode: "OPERATIONAL_RESPONSIBILITY",
    });
    expect(granted.outcomeCode).toBe("PROVIDER_ADMIN_GRANTED");
    expect(grant.setProviderAdminMembership).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    expect(grant.identityAuthority.reconcileProviderAdminRole).toHaveBeenCalledWith({ userId: "worker-user-1", shouldBeEnabled: true });
    expect(grant.context.workforce.lockWorker).toHaveBeenCalledWith("provider-1", "worker-1");

    const revoke = createHighRiskHarness({ adminMembership: { id: "admin-membership-1", active: true, version: 3 }, remainingAdminMemberships: 1 });
    const revoked = await revoke.authority.change({
      ...highRiskBase,
      action: "REVOKE",
      expectedMembershipVersion: 3,
      reasonCode: "RESPONSIBILITY_ENDED",
    });
    expect(revoked.outcomeCode).toBe("PROVIDER_ADMIN_REVOKED");
    expect(revoke.identityAuthority.reconcileProviderAdminRole).toHaveBeenCalledWith({ userId: "worker-user-1", shouldBeEnabled: true });
  });

  it("revokes a pending reset invitation with exactly one notification recipient", async () => {
    const harness = createHighRiskHarness({ accessStatus: "INVITED" });
    const result = await harness.access.revoke({
      ...highRiskBase, expectedAccessVersion: 2, reasonCode: "ACCESS_NO_LONGER_REQUIRED", note: " no longer needed ",
    });
    expect(result.outcomeCode).toBe("WORKER_LOGIN_ACCESS_REVOKED");
    expect(harness.context.workforce.transitionInvitation).toHaveBeenCalledWith(expect.objectContaining({ status: "REVOKED" }));
    expect(harness.histories.map((entry) => entry["targetType"])).toEqual(["INVITATION", "LOGIN_ACCESS"]);
    expect(harness.notifications).toHaveLength(1);
    expect(harness.notifications[0]).toMatchObject({ recipientUserId: "worker-user-1", invitationId: "invitation-1" });
    expect(harness.notifications[0]).not.toHaveProperty("recipientEmailNormalized");
  });

  it("rejects invalid email, failed proof, unconsumed proof, stale access, and missing latest invitation", async () => {
    const invalidEmail = createHighRiskHarness();
    await expect(invalidEmail.access.reset({ ...highRiskBase, expectedAccessVersion: 2, email: "not-email", locale: "EN" })).rejects.toMatchObject({ code: "WORKFORCE_VALIDATION_FAILED" });
    expect(invalidEmail.context.commands.begin).not.toHaveBeenCalled();

    const failedProof = createHighRiskHarness();
    vi.mocked(failedProof.recentProof.verify).mockRejectedValueOnce(new Error("invalid proof"));
    await expect(failedProof.access.revoke({ ...highRiskBase, expectedAccessVersion: 2, reasonCode: "SECURITY_CONCERN" })).rejects.toMatchObject({ code: "WORKFORCE_REAUTHENTICATION_REQUIRED" });
    expect(failedProof.context.commands.begin).not.toHaveBeenCalled();
    expect(failedProof.setWorkerAccessStatus).not.toHaveBeenCalled();

    const unconsumed = createHighRiskHarness();
    vi.mocked(unconsumed.context.proofUseAuthorizer.assertConsumed).mockResolvedValueOnce(false);
    await expect(unconsumed.access.revoke({ ...highRiskBase, expectedAccessVersion: 2, reasonCode: "SECURITY_CONCERN" })).rejects.toMatchObject({ code: "WORKFORCE_REAUTHENTICATION_REQUIRED" });

    const stale = createHighRiskHarness();
    await expect(stale.access.revoke({ ...highRiskBase, expectedAccessVersion: 99, reasonCode: "SECURITY_CONCERN" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    const noLatest = createHighRiskHarness();
    vi.mocked(noLatest.context.workforce.getLatestInvitation).mockResolvedValueOnce(null);
    await expect(noLatest.access.reset({ ...highRiskBase, expectedAccessVersion: 2, email: "worker@example.invalid", locale: "EN" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });

  it("fails closed for missing Provider/Worker and incompatible Admin membership versions", async () => {
    const missingProvider = createHighRiskHarness();
    vi.mocked(missingProvider.context.workforce.lockProvider).mockResolvedValueOnce(null);
    await expect(missingProvider.access.revoke({ ...highRiskBase, expectedAccessVersion: 2, reasonCode: "SECURITY_CONCERN" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });

    const missingWorker = createHighRiskHarness();
    vi.mocked(missingWorker.context.workforce.lockWorker).mockResolvedValueOnce(null);
    await expect(missingWorker.authority.change({ ...highRiskBase, action: "GRANT", expectedMembershipVersion: null, reasonCode: "OPERATIONAL_RESPONSIBILITY" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });

    const ownerMembership = createHighRiskHarness();
    vi.mocked(ownerMembership.context.workforce.lockProviderMember).mockResolvedValueOnce({ id: "owner-member", providerId: "provider-1", userId: "worker-user-1", level: "OWNER", active: true, version: 1 });
    await expect(ownerMembership.authority.change({ ...highRiskBase, action: "GRANT", expectedMembershipVersion: 1, reasonCode: "OPERATIONAL_RESPONSIBILITY" })).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });

    const wrongGrantVersion = createHighRiskHarness({ adminMembership: { id: "admin-membership-1", active: false, version: 2 } });
    await expect(wrongGrantVersion.authority.change({ ...highRiskBase, action: "GRANT", expectedMembershipVersion: 1, reasonCode: "OPERATIONAL_RESPONSIBILITY" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    const missingRevoke = createHighRiskHarness();
    await expect(missingRevoke.authority.change({ ...highRiskBase, action: "REVOKE", expectedMembershipVersion: 1, reasonCode: "RESPONSIBILITY_ENDED" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });
});
