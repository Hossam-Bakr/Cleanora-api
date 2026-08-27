
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceService } from "../../../src/modules/providers/provider-workforce.service.js";

const current: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 3, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Cleaner", gender: "FEMALE", operationalPhoneE164: "+201011111111", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [], avatarMediaFileId: null, version: 2 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = { id: "team-1", providerId: current.providerId, name: "Crew", normalizedName: "crew", status: "ACTIVE", primarySupervisorWorkerId: current.id, version: 4 };
const membership: TeamMemberSnapshot = { id: "membership-1", teamId: team.id, workerId: current.id, cleans: true, version: 2, endedAt: null, worker: current };

function createHarness(options: { readonly membershipCleans?: boolean; readonly otherCleaner?: boolean } = {}) {
  const currentMembership = { ...membership, cleans: options.membershipCleans ?? true };
  const otherWorker: WorkerSnapshot = { ...current, id: "worker-2", identityUserId: "user-2", profile: { ...current.profile, supervisorCapable: false } };
  const members: TeamMemberSnapshot[] = [currentMembership];
  if (options.otherCleaner === true) members.push({ id: "membership-2", teamId: team.id, workerId: otherWorker.id, cleans: true, version: 1, endedAt: null, worker: otherWorker });
  const updateTeam = vi.fn(async () => ({ ...team, primarySupervisorWorkerId: null, version: 5 }));
  const replaceWorkerProfile = vi.fn(async (input: { readonly profile: WorkerSnapshot["profile"] }) => ({
    ...current,
    version: 4,
    profile: { ...input.profile, avatarMediaFileId: current.profile.avatarMediaFileId, version: 3 },
  }));
  const appendHistory = vi.fn(async () => ({ id: `history-${appendHistory.mock.calls.length}` }));
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: current.providerId, workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level: "ADMIN" as const, active: true, version: 1 })),
      lockWorker: vi.fn(async () => current),
      getWorker: vi.fn(async () => current),
      getCurrentMembershipForWorker: vi.fn(async () => currentMembership),
      lockTeam: vi.fn(async () => team),
      getMembership: vi.fn(async () => currentMembership),
      listCurrentTeamMembers: vi.fn(async () => members),
      updateTeam,
      replaceWorkerProfile,
      countPrimarySupervisorAssignments: vi.fn(async () => 0),
    },
    identityAuthority: { reconcileProviderSupervisorRole: vi.fn(async () => undefined) },
    commands: { begin: vi.fn(async () => ({ replay: false, result: null })), accept: vi.fn(async () => undefined) },
    history: { append: appendHistory },
    audit: { append: vi.fn(async () => ({ id: "audit-1", createdAt: new Date().toISOString() })) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  return { service: new ProviderWorkforceService({ unitOfWork }), context, updateTeam, replaceWorkerProfile, appendHistory };
}

const base = {
  actorUserId: "admin-1",
  providerId: current.providerId,
  workerId: current.id,
  requestId: "00000000-0000-4000-8000-000000000601",
  idempotencyKey: "00000000-0000-4000-8000-000000000602",
  expectedVersion: current.profile.version,
  profile: {
    fullLegalName: current.profile.fullLegalName,
    gender: "female" as const,
    operationalPhoneE164: current.profile.operationalPhoneE164,
    workerType: "CLEANING_STAFF" as const,
    displayTitle: null,
    supervisorCapable: true,
    skillTags: [] as readonly string[],
  },
};

describe("profile classification effects on Team invariants", () => {
  it("rejects Cleaner-to-Escort until the current membership has cleans=false", async () => {
    const harness = createHarness();
    await expect(harness.service.replaceWorkerProfile({ ...base, profile: { ...base.profile, workerType: "ESCORT" } }))
      .rejects.toMatchObject({ code: "WORKFORCE_ESCORT_MEMBERSHIP_CONFLICT" });
    expect(harness.replaceWorkerProfile).not.toHaveBeenCalled();
  });

  it("allows a non-cleaning Escort and preserves independent Supervisor capability", async () => {
    const harness = createHarness({ membershipCleans: false });
    const result = await harness.service.replaceWorkerProfile({ ...base, profile: { ...base.profile, workerType: "ESCORT", supervisorCapable: true } });
    expect(result.worker).toMatchObject({ workerType: "ESCORT", supervisorCapable: true });
  });

  it("rejects loss of the final active Team cleaner before profile persistence", async () => {
    const harness = createHarness();
    await expect(harness.service.replaceWorkerProfile({ ...base, profile: { ...base.profile, workerType: "OTHER" } }))
      .rejects.toMatchObject({ code: "WORKFORCE_FINAL_CLEANER_CONFLICT", safeDetails: { teamId: team.id, teamVersion: team.version } });
    expect(harness.replaceWorkerProfile).not.toHaveBeenCalled();
  });

  it("permits reclassification when another valid cleaner remains", async () => {
    const harness = createHarness({ otherCleaner: true });
    await expect(harness.service.replaceWorkerProfile({ ...base, profile: { ...base.profile, workerType: "OTHER" } })).resolves.toBeDefined();
    expect(harness.replaceWorkerProfile).toHaveBeenCalledTimes(1);
  });

  it("clears primary Supervisor before persisting capability loss and reconciles only that role", async () => {
    const harness = createHarness({ otherCleaner: true });
    await harness.service.replaceWorkerProfile({ ...base, profile: { ...base.profile, supervisorCapable: false } });
    expect(harness.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ primarySupervisorWorkerId: null, expectedVersion: team.version }));
    expect(harness.updateTeam.mock.invocationCallOrder[0]).toBeLessThan(harness.replaceWorkerProfile.mock.invocationCallOrder[0]!);
    expect(harness.context.identityAuthority.reconcileProviderSupervisorRole).toHaveBeenCalledWith({ userId: current.identityUserId, shouldBeEnabled: false });
    expect(harness.appendHistory).toHaveBeenCalledWith(expect.objectContaining({ eventCode: "PRIMARY_SUPERVISOR_CLEARED_BY_CAPABILITY_LOSS" }));
  });
});
