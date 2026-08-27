
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderTeamMembershipService } from "../../../src/modules/providers/provider-team-membership.service.js";

const worker = (id: string, identityUserId: string, supervisorCapable = false): WorkerSnapshot => ({
  id,
  providerId: "provider-1",
  identityUserId,
  predecessorWorkerId: null,
  status: "ACTIVE",
  version: 3,
  acceptedInvitationLocale: "EN",
  endedAt: null,
  profile: {
    fullLegalName: id,
    gender: "FEMALE",
    operationalPhoneE164: "+201011111111",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable,
    skills: [],
    avatarMediaFileId: null,
    version: 1,
  },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
});

const supervisor = worker("worker-supervisor", "supervisor-user", true);
const target = worker("worker-target", "target-user");
const backup = worker("worker-backup", "backup-user");
const team: TeamSnapshot = {
  id: "team-1",
  providerId: "provider-1",
  name: "North Crew",
  normalizedName: "north crew",
  status: "ACTIVE",
  primarySupervisorWorkerId: supervisor.id,
  version: 4,
};

function member(id: string, value: WorkerSnapshot, cleans: boolean): TeamMemberSnapshot {
  return { id, teamId: team.id, workerId: value.id, cleans, version: 2, endedAt: null, worker: value };
}

const supervisorMembership = member("membership-supervisor", supervisor, false);
const targetMembership = member("membership-target", target, true);
const backupMembership = member("membership-backup", backup, true);

function createHarness(options: {
  readonly finalCleaner?: boolean;
  readonly assignmentLost?: boolean;
  readonly capabilityLost?: boolean;
  readonly lifecycleLost?: boolean;
  readonly membershipLost?: boolean;
} = {}) {
  const actualSupervisor = {
    ...supervisor,
    ...(options.lifecycleLost === true ? { status: "INACTIVE" as const } : {}),
    profile: {
      ...supervisor.profile,
      ...(options.capabilityLost === true ? { supervisorCapable: false } : {}),
    },
  };
  const actualTeam = options.assignmentLost === true ? { ...team, primarySupervisorWorkerId: null } : team;
  const memberships = [
    { ...supervisorMembership, worker: actualSupervisor, ...(options.membershipLost === true ? { endedAt: new Date() } : {}) },
    targetMembership,
    ...(options.finalCleaner === true ? [] : [backupMembership]),
  ];
  const updateMembership = vi.fn(async () => ({ ...targetMembership, cleans: false, version: 3 }));
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
      lockWorker: vi.fn(async () => target),
      lockTeam: vi.fn(async (_providerId: string, teamId: string) => teamId === team.id
        ? actualTeam
        : { ...team, id: teamId, status: "DRAFT" as const, primarySupervisorWorkerId: null, version: 2 }),
      readActorMembership: vi.fn(async () => null),
      getWorker: vi.fn(async (_providerId: string, workerId: string) => workerId === supervisor.id ? actualSupervisor : target),
      getCurrentMembershipForWorker: vi.fn(async (workerId: string) => memberships.find((value) => value.workerId === workerId && value.endedAt === null) ?? null),
      getMembership: vi.fn(async (_teamId: string, membershipId: string) => memberships.find((value) => value.id === membershipId) ?? null),
      listCurrentTeamMembers: vi.fn(async () => memberships.filter((value) => value.endedAt === null)),
      updateMembership,
      updateTeam: vi.fn(async () => ({ ...actualTeam, status: "INACTIVE" as const, version: 5 })),
      addMembership: vi.fn(),
    },
    commands: { begin: vi.fn(async () => ({ replay: false, result: null })), accept: vi.fn(async () => undefined) },
    history: { append: vi.fn(async () => ({ id: "history-1" })) },
    audit: { append: vi.fn(async () => ({ id: "audit-1", createdAt: new Date().toISOString() })) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  return { service: new ProviderTeamMembershipService({ unitOfWork }), context, updateMembership };
}

const common = {
  actorUserId: supervisor.identityUserId!,
  providerId: team.providerId,
  teamId: team.id,
  workerId: target.id,
  requestId: "00000000-0000-4000-8000-000000000751",
  idempotencyKey: "00000000-0000-4000-8000-000000000752",
  expectedVersion: team.version,
  expectedWorkerVersion: target.version,
};

describe("DEC-039 primary Supervisor exact authority", () => {
  it("allows only cleans on an existing member of the exact current Team", async () => {
    const harness = createHarness();
    await expect(harness.service.change({
      ...common,
      action: "UPDATE_CLEANS",
      membershipId: targetMembership.id,
      cleans: false,
      expectedMembershipVersion: targetMembership.version,
      confirmLastCleanerImpact: false,
    })).resolves.toMatchObject({ outcomeCode: "TEAM_MEMBERSHIP_CLEANS_UPDATED" });
    expect(harness.updateMembership).toHaveBeenCalledWith(expect.objectContaining({ cleans: false }));
  });

  it("denies add, remove, and move without any membership write", async () => {
    const commands = [
      { ...common, action: "ADD" as const, cleans: false },
      { ...common, action: "REMOVE" as const, membershipId: targetMembership.id, expectedMembershipVersion: 2, confirmLastCleanerImpact: false },
      { ...common, action: "MOVE" as const, membershipId: targetMembership.id, targetTeamId: "team-2", cleans: false, expectedMembershipVersion: 2, expectedTargetTeamVersion: 2, confirmLastCleanerImpact: false },
    ];
    for (const command of commands) {
      const harness = createHarness();
      await expect(harness.service.change(command)).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });
      expect(harness.context.workforce.updateMembership).not.toHaveBeenCalled();
      expect(harness.context.workforce.addMembership).not.toHaveBeenCalled();
    }
  });

  it("cannot confirm a final-cleaner change even when the confirmation flag is submitted", async () => {
    const harness = createHarness({ finalCleaner: true });
    await expect(harness.service.change({
      ...common,
      action: "UPDATE_CLEANS",
      membershipId: targetMembership.id,
      cleans: false,
      expectedMembershipVersion: targetMembership.version,
      confirmLastCleanerImpact: true,
    })).rejects.toMatchObject({ code: "WORKFORCE_FINAL_CLEANER_CONFLICT" });
    expect(harness.updateMembership).not.toHaveBeenCalled();
    expect(harness.context.workforce.updateTeam).not.toHaveBeenCalled();
  });

  it("loses authority immediately after assignment, capability, lifecycle, or membership invalidation", async () => {
    for (const options of [
      { assignmentLost: true },
      { capabilityLost: true },
      { lifecycleLost: true },
      { membershipLost: true },
    ]) {
      const harness = createHarness(options);
      await expect(harness.service.change({
        ...common,
        action: "UPDATE_CLEANS",
        membershipId: targetMembership.id,
        cleans: false,
        expectedMembershipVersion: targetMembership.version,
        confirmLastCleanerImpact: false,
      })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
      expect(harness.updateMembership).not.toHaveBeenCalled();
    }
  });
});
