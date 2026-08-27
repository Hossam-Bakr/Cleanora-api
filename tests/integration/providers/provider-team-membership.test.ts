
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderTeamMembershipService } from "../../../src/modules/providers/provider-team-membership.service.js";

const now = new Date("2026-08-22T16:00:00.000Z");
const cleaner: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 3, acceptedInvitationLocale: "EN", endedAt: null,
  profile: {
    fullLegalName: "Cleaner", gender: "FEMALE", operationalPhoneE164: "+201011111111",
    workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [],
    avatarMediaFileId: null, version: 1,
  },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = {
  id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew",
  status: "ACTIVE", primarySupervisorWorkerId: cleaner.id, version: 4,
};
const membership: TeamMemberSnapshot = {
  id: "membership-1", teamId: team.id, workerId: cleaner.id, cleans: true,
  version: 2, endedAt: null, worker: cleaner,
};

function createHarness(options: {
  readonly actorLevel?: "OWNER" | "ADMIN" | null;
  readonly worker?: WorkerSnapshot;
  readonly team?: TeamSnapshot;
  readonly members?: readonly TeamMemberSnapshot[];
  readonly supervisorActor?: boolean;
  readonly targetTeam?: TeamSnapshot;
} = {}) {
  let currentTeam = options.team ?? team;
  const currentWorker = options.worker ?? cleaner;
  let members = [...(options.members ?? [membership])];
  const histories: Array<Readonly<Record<string, unknown>>> = [];
  const updateMembership = vi.fn(async (input: { readonly membershipId: string; readonly cleans?: boolean; readonly endedAt?: Date }) => {
    const existing = members.find((value) => value.id === input.membershipId)!;
    const changed = { ...existing, cleans: input.cleans ?? existing.cleans, endedAt: input.endedAt ?? existing.endedAt, version: existing.version + 1 };
    members = members.map((value) => value.id === changed.id ? changed : value);
    return changed;
  });
  const addMembership = vi.fn(async (input: { readonly teamId: string; readonly membershipId: string; readonly workerId: string; readonly cleans: boolean }) => {
    const changed = { id: input.membershipId, teamId: input.teamId, workerId: input.workerId, cleans: input.cleans, version: 1, endedAt: null, worker: currentWorker };
    members.push(changed);
    return changed;
  });
  const updateTeam = vi.fn(async (input: { readonly teamId: string; readonly status?: TeamSnapshot["status"]; readonly primarySupervisorWorkerId?: string | null }) => {
    currentTeam = { ...currentTeam, status: input.status ?? currentTeam.status, primarySupervisorWorkerId: input.primarySupervisorWorkerId === undefined ? currentTeam.primarySupervisorWorkerId : input.primarySupervisorWorkerId, version: currentTeam.version + 1 };
    return currentTeam;
  });
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => options.actorLevel === null
        ? null
        : { level: options.actorLevel ?? "OWNER", active: true, version: 1 }),
      lockTeam: vi.fn(async (_providerId: string, teamId: string) => teamId === currentTeam.id
        ? currentTeam
        : options.targetTeam ?? ({ ...currentTeam, id: teamId, status: "DRAFT" as const, primarySupervisorWorkerId: null, version: 2 })),
      getTeam: vi.fn(async (_providerId: string, teamId: string) => teamId === currentTeam.id
        ? currentTeam
        : options.targetTeam ?? ({ ...currentTeam, id: teamId, status: "DRAFT" as const, primarySupervisorWorkerId: null, version: 2 })),
      lockWorker: vi.fn(async () => currentWorker),
      getWorker: vi.fn(async (_providerId: string, workerId: string) => {
        if (workerId === cleaner.id && options.supervisorActor) return { ...cleaner, identityUserId: "supervisor-user" };
        return currentWorker;
      }),
      getCurrentMembershipForWorker: vi.fn(async () => members.find((value) => value.workerId === currentWorker.id && value.endedAt === null) ?? null),
      listCurrentTeamMembers: vi.fn(async (teamId: string) => members.filter((value) => value.teamId === teamId && value.endedAt === null)),
      getMembership: vi.fn(async (_teamId: string, membershipId: string) => members.find((value) => value.id === membershipId) ?? null),
      addMembership,
      updateMembership,
      updateTeam,
      countPrimarySupervisorAssignments: vi.fn(async () => 0),
    },
    identityAuthority: { reconcileProviderSupervisorRole: vi.fn(async () => undefined) },
    commands: { begin: vi.fn(async () => ({ replay: false, result: null })), accept: vi.fn(async () => undefined) },
    history: { append: vi.fn(async (input) => { histories.push(input); return { id: `history-${histories.length}` }; }) },
    audit: { append: vi.fn(async () => ({ auditLogId: "audit-1" })) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  return {
    service: new ProviderTeamMembershipService({ unitOfWork, now: () => now, createId: () => "membership-new" }),
    context, addMembership, updateMembership, updateTeam, histories,
  };
}

const base = {
  actorUserId: "owner-1", providerId: "provider-1", teamId: "team-1",
  requestId: "00000000-0000-4000-8000-000000000801",
  idempotencyKey: "00000000-0000-4000-8000-000000000802",
};

describe("Provider Team membership", () => {
  it("rejects a MOVE to the same Team before any repository write", async () => {
    const harness = createHarness({ members: [membership] });
    await expect(harness.service.change({
      ...base,
      action: "MOVE",
      workerId: cleaner.id,
      membershipId: membership.id,
      targetTeamId: team.id,
      cleans: true,
      expectedVersion: team.version,
      expectedWorkerVersion: cleaner.version,
      expectedMembershipVersion: membership.version,
      expectedTargetTeamVersion: team.version,
      confirmLastCleanerImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_VALIDATION_FAILED", safeDetails: { field: "targetTeamId" } });
    expect(harness.context.workforce.updateMembership).not.toHaveBeenCalled();
    expect(harness.context.workforce.addMembership).not.toHaveBeenCalled();
  });

  it("rejects Escort cleans=true before persistence", async () => {
    const escort = { ...cleaner, profile: { ...cleaner.profile, workerType: "ESCORT" as const } };
    const harness = createHarness({ worker: escort, members: [] });
    await expect(harness.service.change({
      ...base, action: "ADD", workerId: escort.id, cleans: true,
      expectedVersion: 4, expectedWorkerVersion: 3,
    })).rejects.toMatchObject({ code: "WORKFORCE_ESCORT_CANNOT_CLEAN" });
    expect(harness.addMembership).not.toHaveBeenCalled();
  });

  it("allows adding a non-cleaning Escort without changing Worker lifecycle", async () => {
    const escort = { ...cleaner, profile: { ...cleaner.profile, workerType: "ESCORT" as const } };
    const harness = createHarness({ worker: escort, members: [] });
    const result = await harness.service.change({
      ...base, action: "ADD", workerId: escort.id, cleans: false,
      expectedVersion: 4, expectedWorkerVersion: 3,
    });
    expect(result.outcomeCode).toBe("TEAM_MEMBERSHIP_ADDED");
    expect(harness.addMembership).toHaveBeenCalledWith(expect.objectContaining({ cleans: false }));
    expect(harness.context.workforce.lockWorker).toHaveBeenCalled();
  });

  it("rejects a primary Supervisor final-cleaner change with zero state change", async () => {
    const harness = createHarness({ actorLevel: null, supervisorActor: true });
    await expect(harness.service.change({
      ...base, actorUserId: "supervisor-user", action: "UPDATE_CLEANS",
      workerId: cleaner.id, membershipId: membership.id, cleans: false,
      expectedVersion: 4, expectedWorkerVersion: 3, expectedMembershipVersion: 2,
      confirmLastCleanerImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_FINAL_CLEANER_CONFLICT" });
    expect(harness.updateMembership).not.toHaveBeenCalled();
    expect(harness.updateTeam).not.toHaveBeenCalled();
  });

  it("atomically accepts Owner confirmation and inactivates the Team", async () => {
    const harness = createHarness();
    const result = await harness.service.change({
      ...base, action: "UPDATE_CLEANS", workerId: cleaner.id, membershipId: membership.id, cleans: false,
      expectedVersion: 4, expectedWorkerVersion: 3, expectedMembershipVersion: 2,
      confirmLastCleanerImpact: true,
    });
    expect(result.impacts).toEqual(expect.arrayContaining([expect.objectContaining({ outcomeCode: "TEAM_INACTIVATED" })]));
    expect(harness.updateMembership).toHaveBeenCalledWith(expect.objectContaining({ cleans: false, expectedTeamVersion: 4 }));
    expect(harness.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ status: "INACTIVE", expectedVersion: 5 }));
    expect(harness.histories.map((entry) => entry["targetType"])).toEqual(["TEAM_MEMBERSHIP", "TEAM"]);
  });

  it("moves one current membership by ending the source and creating the target", async () => {
    const harness = createHarness({ team: { ...team, status: "INACTIVE", primarySupervisorWorkerId: null } });
    const result = await harness.service.change({
      ...base, action: "MOVE", workerId: cleaner.id, membershipId: membership.id,
      targetTeamId: "team-2", cleans: true, expectedVersion: 4, expectedTargetTeamVersion: 2,
      expectedWorkerVersion: 3, expectedMembershipVersion: 2, confirmLastCleanerImpact: false,
    });
    expect(result.outcomeCode).toBe("TEAM_MEMBERSHIP_MOVED");
    expect(harness.updateMembership).toHaveBeenCalledWith(expect.objectContaining({ endedAt: now }));
    expect(harness.addMembership).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-2", cleans: true }));
  });

  it("rejects an archived MOVE destination before mutating the source", async () => {
    const harness = createHarness({
      team: { ...team, status: "INACTIVE", primarySupervisorWorkerId: null },
      targetTeam: { ...team, id: "team-2", status: "ARCHIVED", primarySupervisorWorkerId: null, version: 2 },
    });
    await expect(harness.service.change({
      ...base,
      action: "MOVE",
      workerId: cleaner.id,
      membershipId: membership.id,
      targetTeamId: "team-2",
      cleans: true,
      expectedVersion: 4,
      expectedTargetTeamVersion: 2,
      expectedWorkerVersion: 3,
      expectedMembershipVersion: 2,
      confirmLastCleanerImpact: false,
    })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    expect(harness.updateMembership).not.toHaveBeenCalled();
    expect(harness.addMembership).not.toHaveBeenCalled();
  });
});
