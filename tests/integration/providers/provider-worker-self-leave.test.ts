
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkerSelfService } from "../../../src/modules/providers/provider-worker-self.service.js";
import type { WorkerAvatarPort } from "../../../src/modules/media/media.public.js";

const now = new Date("2026-08-23T09:00:00.000Z");
const worker: WorkerSnapshot = {
  id: "worker-self-1",
  providerId: "provider-1",
  identityUserId: "worker-user-1",
  predecessorWorkerId: null,
  status: "ACTIVE",
  version: 7,
  acceptedInvitationLocale: "EN",
  endedAt: null,
  profile: {
    fullLegalName: "Current Worker",
    gender: "FEMALE",
    operationalPhoneE164: "+201011111111",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: true,
    skills: ["deep-clean"],
    avatarMediaFileId: null,
    version: 2,
  },
  access: { status: "ACTIVE", version: 3, currentInvitationId: "invitation-1" },
};

function createHarness(options: { readonly finalCleaner?: boolean; readonly replay?: boolean; readonly noCurrent?: boolean } = {}) {
  let current = worker;
  const team: TeamSnapshot = {
    id: "team-1",
    providerId: worker.providerId,
    name: "Alpha",
    normalizedName: "alpha",
    status: "ACTIVE",
    primarySupervisorWorkerId: worker.id,
    version: 5,
  };
  const membership: TeamMemberSnapshot = {
    id: "membership-1",
    teamId: team.id,
    workerId: worker.id,
    cleans: true,
    version: 4,
    endedAt: null,
    worker,
  };
  const setWorkerStatus = vi.fn(async () => {
    current = { ...current, status: "REMOVED", version: 8, endedAt: now };
    return current;
  });
  const setWorkerAccessStatus = vi.fn(async () => {
    current = { ...current, access: { status: "REVOKED", version: 4, currentInvitationId: "invitation-1" } };
    return current;
  });
  const updateMembership = vi.fn(async () => ({ ...membership, version: 5, endedAt: now, worker: current }));
  const updateTeam = vi.fn(async () => ({ ...team, status: "INACTIVE" as const, primarySupervisorWorkerId: null, version: 6 }));
  const appendHistory = vi.fn(async () => ({ id: `history-${appendHistory.mock.calls.length}` }));
  const insertNotification = vi.fn(async () => undefined);
  const replay = { outcomeCode: "WORKER_DEPARTED", targetId: worker.id, version: 8, impacts: [] };
  const context = {
    workforce: {
      getCurrentWorkerByIdentity: vi.fn(async (identityUserId: string) => options.noCurrent !== true && identityUserId === worker.identityUserId ? current : null),
      getLatestWorkerByIdentity: vi.fn(async (identityUserId: string) => identityUserId === worker.identityUserId ? current : null),
      lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 2 })),
      lockWorker: vi.fn(async () => current),
      getCurrentMembershipForWorker: vi.fn(async () => options.finalCleaner === true ? membership : null),
      lockTeam: vi.fn(async () => team),
      getMembership: vi.fn(async () => membership),
      listCurrentTeamMembers: vi.fn(async () => [membership]),
      listReadinessCandidates: vi.fn(async () => options.finalCleaner === true ? [current] : []),
      setWorkerStatus,
      updateMembership,
      updateTeam,
      setWorkerAccessStatus,
      countPrimarySupervisorAssignments: vi.fn(async () => 0),
      countActiveAccessForIdentity: vi.fn(async () => 0),
      getProviderOwnerUserId: vi.fn(async () => "owner-1"),
    },
    commands: {
      begin: vi.fn(async () => options.replay === true ? { replay: true, result: replay } : { replay: false, result: null }),
      accept: vi.fn(async () => undefined),
    },
    history: { append: appendHistory },
    audit: { append: vi.fn(async () => ({ id: "audit-1", createdAt: now.toISOString() })) },
    notifications: { insert: insertNotification },
    identityReader: {
      getIdentity: vi.fn(async (userId: string) => ({
        userId,
        status: "ACTIVE" as const,
        isAccountActive: true,
        emailNormalized: `${userId}@example.invalid`,
        workerRoleEnabled: true,
        providerSupervisorRoleEnabled: userId === worker.identityUserId,
        preferredLanguage: userId === "owner-1" ? "AR" as const : "EN" as const,
      })),
    },
    identityAuthority: {
      reconcileWorkerRole: vi.fn(async () => undefined),
      reconcileProviderSupervisorRole: vi.fn(async () => undefined),
    },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  const avatar: WorkerAvatarPort = {
    ingest: vi.fn(),
    readValidationReceipt: vi.fn(),
    issuePrivateDelivery: vi.fn(async () => ({
      url: "https://private.example.invalid/self-avatar",
      expiresAt: new Date("2026-08-23T09:05:00.000Z"),
    })),
    requestCleanup: vi.fn(),
  };
  return {
    service: new ProviderWorkerSelfService({ unitOfWork, avatar, now: () => now }),
    context,
    setWorkerStatus,
    setWorkerAccessStatus,
    updateMembership,
    updateTeam,
    appendHistory,
    insertNotification,
    avatar,
  };
}

const leaveCommand = {
  actorUserId: worker.identityUserId!,
  requestId: "00000000-0000-4000-8000-000000000401",
  idempotencyKey: "00000000-0000-4000-8000-000000000402",
  expectedVersion: worker.version,
  confirmTeamImpact: false,
  confirmReadinessImpact: false,
};

describe("current Worker self context and departure", () => {
  it("returns only the trusted identity's current private Worker context", async () => {
    const harness = createHarness();
    await expect(harness.service.getCurrent(worker.identityUserId!)).resolves.toMatchObject({
      viewScope: "SELF",
      worker: { workerId: worker.id, providerId: worker.providerId },
      operationalPhoneE164: worker.profile.operationalPhoneE164,
    });
    await expect(harness.service.getCurrent("other-user")).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
  });

  it("atomically ends the engagement, Provider access, and Worker role while preserving the shared identity", async () => {
    const harness = createHarness();
    const result = await harness.service.leave(leaveCommand);

    expect(result).toMatchObject({ outcomeCode: "WORKER_DEPARTED", targetId: worker.id, version: 8 });
    expect(harness.setWorkerStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "REMOVED", endedAt: now }));
    expect(harness.setWorkerAccessStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "REVOKED" }));
    expect(harness.context.identityAuthority.reconcileWorkerRole).toHaveBeenCalledWith({ userId: worker.identityUserId, shouldBeEnabled: false });
    expect(harness.context.identityAuthority).not.toHaveProperty("disableUser");
    expect(harness.insertNotification).toHaveBeenCalledWith(expect.objectContaining({
      template: "WORKER_DEPARTED",
      locale: "AR",
      recipientUserId: "owner-1",
    }));
    expect(harness.appendHistory).toHaveBeenCalledWith(expect.objectContaining({ eventCode: "WORKER_DEPARTED" }));
  });

  it("rejects missing last-cleaner confirmations before any accepted mutation", async () => {
    const harness = createHarness({ finalCleaner: true });
    await expect(harness.service.leave(leaveCommand)).rejects.toMatchObject({
      code: "WORKFORCE_STATE_CONFLICT",
      safeDetails: { teamId: "team-1", teamVersion: 5, teamWillBecomeInactive: true },
    });
    expect(harness.setWorkerStatus).not.toHaveBeenCalled();
    expect(harness.updateMembership).not.toHaveBeenCalled();
    expect(harness.updateTeam).not.toHaveBeenCalled();
  });

  it("accepts exact Team/readiness confirmation and clears Supervisor authority atomically", async () => {
    const harness = createHarness({ finalCleaner: true });
    const result = await harness.service.leave({
      ...leaveCommand,
      expectedTeamVersion: 5,
      expectedMembershipVersion: 4,
      confirmTeamImpact: true,
      confirmReadinessImpact: true,
    });
    expect(result.impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetType: "TEAM_MEMBERSHIP" }),
      expect.objectContaining({ targetType: "TEAM", outcomeCode: "TEAM_INACTIVATED" }),
      expect.objectContaining({ targetType: "READINESS", outcomeCode: "WORKERS_READY_LOST" }),
    ]));
    expect(harness.updateMembership).toHaveBeenCalledTimes(1);
    expect(harness.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ status: "INACTIVE", primarySupervisorWorkerId: null }));
    const lockWorker = harness.context.workforce.lockWorker as ReturnType<typeof vi.fn>;
    const lockTeam = harness.context.workforce.lockTeam as ReturnType<typeof vi.fn>;
    const getMembership = harness.context.workforce.getMembership as ReturnType<typeof vi.fn>;
    expect(lockWorker.mock.invocationCallOrder[0]).toBeLessThan(lockTeam.mock.invocationCallOrder[0]!);
    expect(lockTeam.mock.invocationCallOrder[0]).toBeLessThan(getMembership.mock.invocationCallOrder[0]!);
    expect(getMembership.mock.invocationCallOrder[0]).toBeLessThan(harness.setWorkerStatus.mock.invocationCallOrder[0]!);
    expect(harness.context.identityAuthority.reconcileProviderSupervisorRole).toHaveBeenCalledWith({
      userId: worker.identityUserId,
      shouldBeEnabled: false,
    });
  });

  it("replays the stored safe result without repeating state, history, or notification writes", async () => {
    const harness = createHarness({ replay: true, noCurrent: true });
    await expect(harness.service.leave(leaveCommand)).resolves.toMatchObject({ outcomeCode: "WORKER_DEPARTED", version: 8 });
    expect(harness.setWorkerStatus).not.toHaveBeenCalled();
    expect(harness.appendHistory).not.toHaveBeenCalled();
    expect(harness.insertNotification).not.toHaveBeenCalled();
  });
});
