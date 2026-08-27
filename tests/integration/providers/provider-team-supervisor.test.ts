
import type { ProvidersWorkforceTransactionContext, ProvidersWorkforceUnitOfWorkPort, TeamMemberSnapshot, TeamSnapshot, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderTeamSupervisorService } from "../../../src/modules/providers/provider-team-supervisor.service.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 3, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Supervisor", gender: "MALE", operationalPhoneE164: "+201011111111", workerType: "OTHER", displayTitle: null, supervisorCapable: true, skills: [], avatarMediaFileId: null, version: 2 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "North", normalizedName: "north", status: "ACTIVE", primarySupervisorWorkerId: null, version: 4 };
const membership: TeamMemberSnapshot = { id: "membership-1", teamId: team.id, workerId: worker.id, cleans: false, version: 2, endedAt: null, worker };

function createHarness(overrides: { readonly worker?: WorkerSnapshot; readonly membership?: TeamMemberSnapshot | null; readonly team?: TeamSnapshot; readonly remaining?: number } = {}) {
  let currentTeam = overrides.team ?? team;
  const currentWorker = overrides.worker ?? worker;
  const currentMembership = overrides.membership === undefined ? membership : overrides.membership;
  const updateTeam = vi.fn(async (input: { readonly primarySupervisorWorkerId?: string | null }) => {
    currentTeam = { ...currentTeam, primarySupervisorWorkerId: input.primarySupervisorWorkerId === undefined ? currentTeam.primarySupervisorWorkerId : input.primarySupervisorWorkerId, version: currentTeam.version + 1 };
    return currentTeam;
  });
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level: "ADMIN" as const, active: true, version: 1 })),
      lockWorker: vi.fn(async () => currentWorker),
      getTeam: vi.fn(async () => currentTeam),
      lockTeam: vi.fn(async () => currentTeam),
      getCurrentMembershipForWorker: vi.fn(async () => currentMembership),
      getMembership: vi.fn(async () => currentMembership),
      updateTeam,
      countPrimarySupervisorAssignments: vi.fn(async () => overrides.remaining ?? (currentTeam.primarySupervisorWorkerId === currentWorker.id ? 1 : 0)),
    },
    identityAuthority: { reconcileProviderSupervisorRole: vi.fn(async () => undefined) },
    commands: { begin: vi.fn(async () => ({ replay: false, result: null })), accept: vi.fn(async () => undefined) },
    history: { append: vi.fn(async () => ({ id: "history-1" })) },
    audit: { append: vi.fn(async () => ({ auditLogId: "audit-1" })) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  return { service: new ProviderTeamSupervisorService({ unitOfWork }), context, updateTeam };
}

const base = { actorUserId: "admin-1", providerId: "provider-1", teamId: "team-1", requestId: "00000000-0000-4000-8000-000000000811", idempotencyKey: "00000000-0000-4000-8000-000000000812", expectedVersion: 4 };

describe("Provider Team primary Supervisor", () => {
  it("assigns only an active capable current member and reconciles the global projection", async () => {
    const harness = createHarness();
    const result = await harness.service.change({ ...base, action: "ASSIGN", workerId: worker.id, expectedWorkerVersion: 3, expectedMembershipVersion: 2 });
    expect(result.outcomeCode).toBe("PRIMARY_SUPERVISOR_ASSIGNED");
    expect(harness.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ primarySupervisorWorkerId: worker.id }));
    expect(harness.context.identityAuthority.reconcileProviderSupervisorRole).toHaveBeenCalledWith({ userId: "user-1", shouldBeEnabled: true });
  });

  it.each([
    [{ ...worker, status: "INACTIVE" as const }, membership],
    [{ ...worker, profile: { ...worker.profile, supervisorCapable: false } }, membership],
    [worker, null],
  ])("rejects an ineligible assignment without changing the Team", async (candidate, currentMembership) => {
    const harness = createHarness({ worker: candidate, membership: currentMembership });
    await expect(harness.service.change({ ...base, action: "ASSIGN", workerId: worker.id, expectedWorkerVersion: 3, expectedMembershipVersion: 2 }))
      .rejects.toMatchObject({ code: "WORKFORCE_SUPERVISOR_INVALID" });
    expect(harness.updateTeam).not.toHaveBeenCalled();
  });

  it("stores an eligible pre-account Supervisor assignment and defers role reconciliation", async () => {
    const harness = createHarness({ worker: { ...worker, identityUserId: null } });
    await expect(harness.service.change({
      ...base,
      action: "ASSIGN",
      workerId: worker.id,
      expectedWorkerVersion: 3,
      expectedMembershipVersion: 2,
    })).resolves.toMatchObject({ outcomeCode: "PRIMARY_SUPERVISOR_ASSIGNED" });
    expect(harness.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ primarySupervisorWorkerId: worker.id }));
    expect(harness.context.identityAuthority.reconcileProviderSupervisorRole).not.toHaveBeenCalled();
  });

  it("fails closed if a widened persistence adapter returns a non-management membership level", async () => {
    const harness = createHarness();
    (harness.context.workforce.readActorMembership as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ level: "WORKER", active: true, version: 1 } as never);
    await expect(harness.service.change({
      ...base,
      action: "ASSIGN",
      workerId: worker.id,
      expectedWorkerVersion: 3,
      expectedMembershipVersion: 2,
    })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
    expect(harness.updateTeam).not.toHaveBeenCalled();
  });

  it("clears assignment and keeps the role only when another valid assignment remains", async () => {
    const harness = createHarness({ team: { ...team, primarySupervisorWorkerId: worker.id }, remaining: 1 });
    const result = await harness.service.change({ ...base, action: "CLEAR" });
    expect(result.outcomeCode).toBe("PRIMARY_SUPERVISOR_CLEARED");
    expect(harness.context.identityAuthority.reconcileProviderSupervisorRole).toHaveBeenCalledWith({ userId: "user-1", shouldBeEnabled: true });
  });
});
