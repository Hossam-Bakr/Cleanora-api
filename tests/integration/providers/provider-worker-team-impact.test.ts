import type {
  ProvidersWorkforceTransactionContext,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceLifecycleService } from "../../../src/modules/providers/provider-workforce-lifecycle.service.js";

const now = new Date("2026-08-23T11:00:00.000Z");
const baseWorker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "worker-user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 4, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Final Cleaner", gender: "FEMALE", operationalPhoneE164: "+201000000001", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [], avatarMediaFileId: null, version: 1 },
  access: { status: "ACTIVE", version: 2, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew", status: "ACTIVE", primarySupervisorWorkerId: baseWorker.id, version: 3 };
const membership: TeamMemberSnapshot = { id: "membership-1", teamId: team.id, workerId: baseWorker.id, cleans: true, version: 2, endedAt: null, worker: baseWorker };

function harness(options: {
  readonly worker?: WorkerSnapshot;
  readonly actorLevel?: "OWNER" | "ADMIN" | null;
  readonly membership?: TeamMemberSnapshot | null;
  readonly team?: TeamSnapshot | null;
  readonly candidates?: readonly WorkerSnapshot[];
  readonly proofConsumed?: boolean;
  readonly proofFails?: boolean;
  readonly replay?: Readonly<Record<string, unknown>> | null;
} = {}) {
  let worker = options.worker ?? baseWorker;
  let currentTeam = options.team === undefined ? team : options.team;
  const currentMembership = options.membership === undefined ? membership : options.membership;
  const histories: Array<Readonly<Record<string, unknown>>> = [];
  const impacts: Array<Readonly<Record<string, unknown>>> = [];
  const workforce = {
    lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
    readActorMembership: vi.fn(async () => options.actorLevel === null ? null : ({ level: options.actorLevel ?? "OWNER", active: true, version: 1 })),
    lockWorker: vi.fn(async () => worker),
    getCurrentMembershipForWorker: vi.fn(async () => currentMembership),
    lockTeam: vi.fn(async () => currentTeam),
    getMembership: vi.fn(async () => currentMembership),
    listCurrentTeamMembers: vi.fn(async () => currentMembership === null ? [] : [currentMembership]),
    listReadinessCandidates: vi.fn(async () => options.candidates ?? [worker]),
    setWorkerStatus: vi.fn(async (input: { readonly status: WorkerSnapshot["status"]; readonly endedAt?: Date }) => {
      worker = { ...worker, status: input.status, version: worker.version + 1, endedAt: input.endedAt ?? worker.endedAt };
      return worker;
    }),
    updateMembership: vi.fn(async () => ({ ...membership, version: 3, endedAt: now, worker })),
    updateTeam: vi.fn(async (input: { readonly status?: TeamSnapshot["status"]; readonly primarySupervisorWorkerId?: string | null }) => {
      currentTeam = currentTeam === null ? null : {
        ...currentTeam,
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.primarySupervisorWorkerId === undefined ? {} : { primarySupervisorWorkerId: input.primarySupervisorWorkerId }),
        version: currentTeam.version + 1,
      };
      return currentTeam!;
    }),
    countPrimarySupervisorAssignments: vi.fn(async () => 0),
    setWorkerAccessStatus: vi.fn(async () => {
      worker = { ...worker, access: { status: "REVOKED", version: 3, currentInvitationId: worker.access?.currentInvitationId ?? null } };
      return worker;
    }),
    getLatestInvitation: vi.fn(async () => ({
      id: "invitation-1", workerId: worker.id, invitationVersion: 1, emailNormalized: "worker@example.invalid",
      locale: "EN" as const, status: "PENDING" as const, version: 1, issuedByUserId: "owner-1",
      acceptedByUserId: null, issuedAt: now, expiresAt: new Date(now.getTime() + 60_000), acceptedAt: null,
      revokedAt: null, expiredAt: null, supersededAt: null,
    })),
    transitionInvitation: vi.fn(async () => {
      worker = { ...worker, access: { status: "REVOKED", version: 3, currentInvitationId: "invitation-1" } };
      return {
        worker,
        invitation: {
          id: "invitation-1", workerId: worker.id, invitationVersion: 1, emailNormalized: "worker@example.invalid",
          locale: "EN" as const, status: "REVOKED" as const, version: 2, issuedByUserId: "owner-1",
          acceptedByUserId: null, issuedAt: now, expiresAt: new Date(now.getTime() + 60_000), acceptedAt: null,
          revokedAt: now, expiredAt: null, supersededAt: null,
        },
      };
    }),
    countActiveAccessForIdentity: vi.fn(async () => 0),
  };
  const context = {
    workforce,
    identityReader: { getIdentity: vi.fn(async () => ({
      userId: "worker-user-1", status: "ACTIVE" as const, isAccountActive: true,
      emailNormalized: "worker@example.invalid", workerRoleEnabled: true,
      providerSupervisorRoleEnabled: true, preferredLanguage: "EN" as const,
    })) },
    identityAuthority: {
      reconcileProviderSupervisorRole: vi.fn(async () => undefined),
      reconcileWorkerRole: vi.fn(async () => undefined),
    },
    proofUseAuthorizer: { assertConsumed: vi.fn(async () => options.proofConsumed ?? true) },
    commands: {
      begin: vi.fn(async () => options.replay === undefined ? ({ replay: false, result: null }) : ({ replay: true, result: options.replay })),
      accept: vi.fn(async (input) => { impacts.push(input); }),
    },
    history: { append: vi.fn(async (input) => { histories.push(input); return { id: `history-${histories.length}` }; }) },
    audit: { append: vi.fn(async () => ({ auditLogId: "audit-1" })) },
    notifications: { insert: vi.fn(async () => undefined) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const recentProof = { verify: vi.fn(async () => {
    if (options.proofFails) throw new Error("invalid proof");
    return { proofId: "proof-1", authenticatedAt: new Date(now.getTime() - 1_000), expiresAt: new Date(now.getTime() + 599_000) };
  }) };
  return {
    service: new ProviderWorkforceLifecycleService({
      unitOfWork: { run: async (callback) => callback(context) }, recentProof, now: () => now,
    }),
    context, workforce, histories, recentProof,
  };
}

const base = {
  actorUserId: "owner-1", sessionId: "session-1", providerId: "provider-1", workerId: "worker-1",
  requestId: "request-1", idempotencyKey: "00000000-0000-4000-8000-000000000711", expectedVersion: 4,
};

describe("Worker lifecycle Team/readiness impact atomicity", () => {
  it("atomically inactivates the final-cleaner Team, clears Supervisor, and records readiness loss", async () => {
    const { service, workforce, context, histories } = harness();
    const result = await service.transition({
      ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", note: " approved ",
      confirmTeamImpact: true, confirmReadinessImpact: true, expectedTeamVersion: 3, expectedMembershipVersion: 2,
    });
    expect(result).toMatchObject({ outcomeCode: "WORKER_DEACTIVATED", version: 5 });
    expect(result.impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ outcomeCode: "TEAM_INACTIVATED" }),
      expect.objectContaining({ outcomeCode: "WORKERS_READY_LOST" }),
    ]));
    expect(workforce.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ status: "INACTIVE", primarySupervisorWorkerId: null, expectedVersion: 3 }));
    expect(workforce.lockWorker.mock.invocationCallOrder[0]).toBeLessThan(workforce.lockTeam.mock.invocationCallOrder[0]!);
    expect(workforce.lockTeam.mock.invocationCallOrder[0]).toBeLessThan(workforce.getMembership.mock.invocationCallOrder[0]!);
    expect(workforce.getMembership.mock.invocationCallOrder[0]).toBeLessThan(workforce.setWorkerStatus.mock.invocationCallOrder[0]!);
    expect(context.identityAuthority.reconcileProviderSupervisorRole).toHaveBeenCalledWith({ userId: "worker-user-1", shouldBeEnabled: false });
    expect(histories.map((entry) => entry["targetType"])).toEqual(expect.arrayContaining(["TEAM", "PRIMARY_SUPERVISOR", "WORKER", "READINESS"]));
  });

  it("returns safe conflicts before writes when final-cleaner or readiness confirmation is absent/stale", async () => {
    const teamImpact = harness();
    await expect(teamImpact.service.transition({
      ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE",
      confirmTeamImpact: false, confirmReadinessImpact: true,
    })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT", safeDetails: { teamWillBecomeInactive: true } });
    expect(teamImpact.workforce.setWorkerStatus).not.toHaveBeenCalled();

    const readiness = harness({ membership: null, team: null });
    await expect(readiness.service.transition({
      ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE",
      confirmTeamImpact: false, confirmReadinessImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT", safeDetails: { workersReadyWillBecomeFalse: true } });
    expect(readiness.workforce.setWorkerStatus).not.toHaveBeenCalled();
  });

  it("removes an invited Worker by revoking only the pending invitation/access and ending membership", async () => {
    const invited: WorkerSnapshot = { ...baseWorker, access: { status: "INVITED", version: 2, currentInvitationId: "invitation-1" } };
    const { service, workforce, context, histories } = harness({ worker: invited, candidates: [] });
    const result = await service.transition({
      ...base, action: "REMOVE", reasonCode: "ENGAGEMENT_ENDED", note: "Contract ended",
      recentAuthenticationProof: "opaque-proof", confirmTeamImpact: true, confirmReadinessImpact: false,
      expectedTeamVersion: 3, expectedMembershipVersion: 2,
    });
    expect(result.outcomeCode).toBe("WORKER_REMOVED");
    expect(workforce.updateMembership).toHaveBeenCalledWith(expect.objectContaining({ endedAt: now }));
    expect(workforce.transitionInvitation).toHaveBeenCalledWith(expect.objectContaining({ status: "REVOKED" }));
    expect(context.identityAuthority.reconcileWorkerRole).toHaveBeenCalledWith({ userId: "worker-user-1", shouldBeEnabled: false });
    expect(histories.map((entry) => entry["targetType"])).toEqual(expect.arrayContaining(["TEAM_MEMBERSHIP", "INVITATION", "LOGIN_ACCESS", "WORKER"]));
  });

  it("fails closed for proof verification/consumption, non-Owner removal, stale Worker, and missing Provider", async () => {
    const invalidProof = harness({ proofFails: true });
    await expect(invalidProof.service.transition({
      ...base, action: "REMOVE", reasonCode: "ENGAGEMENT_ENDED", note: "Contract ended",
      recentAuthenticationProof: "bad", confirmTeamImpact: false, confirmReadinessImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_REAUTHENTICATION_REQUIRED" });

    const unconsumed = harness({ proofConsumed: false, membership: null, team: null, candidates: [] });
    await expect(unconsumed.service.transition({
      ...base, action: "REMOVE", reasonCode: "ENGAGEMENT_ENDED", note: "Contract ended",
      recentAuthenticationProof: "proof", confirmTeamImpact: false, confirmReadinessImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_REAUTHENTICATION_REQUIRED" });

    const admin = harness({ actorLevel: "ADMIN" });
    await expect(admin.service.transition({
      ...base, action: "REMOVE", reasonCode: "ENGAGEMENT_ENDED", note: "Contract ended",
      recentAuthenticationProof: "proof", confirmTeamImpact: false, confirmReadinessImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });

    const stale = harness({ worker: { ...baseWorker, version: 5 } });
    await expect(stale.service.transition({ ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", confirmTeamImpact: false, confirmReadinessImpact: false })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    const missing = harness();
    missing.workforce.lockProvider.mockResolvedValueOnce(null as never);
    await expect(missing.service.transition({ ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", confirmTeamImpact: false, confirmReadinessImpact: false })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
  });

  it("replays complete safe outcomes and rejects malformed command results without another write", async () => {
    const replay = harness({ replay: { outcomeCode: "WORKER_DEACTIVATED", targetId: "worker-1", version: 5, impacts: [] } });
    await expect(replay.service.transition({ ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", confirmTeamImpact: false, confirmReadinessImpact: false })).resolves.toMatchObject({ version: 5 });
    expect(replay.workforce.lockProvider).not.toHaveBeenCalled();

    const malformed = harness({ replay: { outcomeCode: "WORKER_DEACTIVATED", targetId: 7, version: 5, impacts: [] } });
    await expect(malformed.service.transition({ ...base, action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE", confirmTeamImpact: false, confirmReadinessImpact: false })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });
});
