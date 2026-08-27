import type {
  ProvidersWorkforceTransactionContext,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderTeamService } from "../../../src/modules/providers/provider-team.service.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 2, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Cleaner", gender: "FEMALE", operationalPhoneE164: "+201000000001", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false, skills: [], avatarMediaFileId: null, version: 1 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const member: TeamMemberSnapshot = { id: "membership-1", teamId: "team-1", workerId: worker.id, cleans: true, version: 1, endedAt: null, worker };
const meta = {
  actorUserId: "admin-1", providerId: "provider-1", requestId: "request-1",
  idempotencyKey: "00000000-0000-4000-8000-000000000701",
};

function harness(initial: TeamSnapshot = {
  id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew",
  status: "DRAFT", primarySupervisorWorkerId: null, version: 1,
}, options: { readonly manager?: boolean; readonly replay?: Readonly<Record<string, unknown>> | null } = {}) {
  let team = initial;
  const workforce = {
    lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 3 })),
    readActorMembership: vi.fn(async () => options.manager === false ? null : ({ level: "ADMIN", active: true, version: 1 })),
    createTeam: vi.fn(async (input: { readonly teamId: string; readonly name: string | null; readonly normalizedName: string | null }) => {
      team = { id: input.teamId, providerId: "provider-1", name: input.name, normalizedName: input.normalizedName, status: "DRAFT", primarySupervisorWorkerId: null, version: 1 };
      return team;
    }),
    getTeam: vi.fn(async () => team),
    lockTeam: vi.fn(async () => team),
    lockWorker: vi.fn(async () => worker),
    listCurrentTeamMembers: vi.fn(async () => [member]),
    updateMembership: vi.fn(async () => ({ ...member, endedAt: new Date(), version: 2 })),
    updateTeam: vi.fn(async (input: { readonly name?: string; readonly normalizedName?: string; readonly status?: TeamSnapshot["status"]; readonly primarySupervisorWorkerId?: string | null }) => {
      team = {
        ...team,
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.normalizedName === undefined ? {} : { normalizedName: input.normalizedName }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.primarySupervisorWorkerId === undefined ? {} : { primarySupervisorWorkerId: input.primarySupervisorWorkerId }),
        version: team.version + 1,
      };
      return team;
    }),
    countPrimarySupervisorAssignments: vi.fn(async () => 0),
  };
  const commands = {
    begin: vi.fn(async () => options.replay === undefined ? ({ replay: false, result: null }) : ({ replay: true, result: options.replay })),
    accept: vi.fn(async () => undefined),
  };
  const context = {
    workforce, commands,
    history: { append: vi.fn(async () => ({ id: "history-1" })) },
    audit: { append: vi.fn(async () => ({ auditLogId: "audit-1" })) },
    identityAuthority: { reconcileProviderSupervisorRole: vi.fn(async () => undefined) },
  } as unknown as ProvidersWorkforceTransactionContext;
  const service = new ProviderTeamService({
    unitOfWork: { run: async (callback) => callback(context) },
    now: () => new Date("2026-08-23T10:00:00.000Z"),
    createId: () => "team-created",
  });
  return { service, context, workforce, commands };
}

describe("Provider Team application service", () => {
  it("creates normalized named and unnamed drafts with audit/history/idempotency", async () => {
    const named = harness();
    await expect(named.service.createDraft({ ...meta, expectedVersion: 3, name: "  North   Crew  " })).resolves.toMatchObject({
      outcomeCode: "TEAM_DRAFT_CREATED", targetId: "team-created", version: 1,
    });
    expect(named.workforce.createTeam).toHaveBeenCalledWith(expect.objectContaining({ name: "North Crew", normalizedName: "north crew" }));
    expect(named.context.history.append).toHaveBeenCalled();
    expect(named.context.audit.append).toHaveBeenCalled();
    expect(named.commands.accept).toHaveBeenCalled();

    const unnamed = harness();
    await unnamed.service.createDraft({ ...meta, expectedVersion: 3, name: null });
    expect(unnamed.workforce.createTeam).toHaveBeenCalledWith(expect.objectContaining({ name: null, normalizedName: null }));
  });

  it("replays only a complete safe result and rejects malformed replay evidence", async () => {
    const replay = harness(undefined, { replay: { outcomeCode: "TEAM_DRAFT_CREATED", targetId: "team-1", version: 1, impacts: [] } });
    await expect(replay.service.createDraft({ ...meta, expectedVersion: 3, name: "North" })).resolves.toMatchObject({ targetId: "team-1" });
    expect(replay.workforce.lockProvider).not.toHaveBeenCalled();

    const malformed = harness(undefined, { replay: { outcomeCode: "TEAM_DRAFT_CREATED" } });
    await expect(malformed.service.createDraft({ ...meta, expectedVersion: 3, name: "North" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });

  it("replaces the name only for an exact active manager scope and version", async () => {
    const active = harness();
    await expect(active.service.replaceName({ ...meta, teamId: "team-1", expectedVersion: 1, name: "  South   Crew " })).resolves.toMatchObject({ outcomeCode: "TEAM_NAME_REPLACED", version: 2 });
    expect(active.workforce.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ name: "South Crew", normalizedName: "south crew" }));

    expect(() => active.service.replaceName({ ...meta, teamId: "team-1", expectedVersion: 2, name: "   " })).toThrowError(expect.objectContaining({ code: "WORKFORCE_VALIDATION_FAILED" }));
    const archived = harness({ id: "team-1", providerId: "provider-1", name: "Old", normalizedName: "old", status: "ARCHIVED", primarySupervisorWorkerId: null, version: 1 });
    await expect(archived.service.replaceName({ ...meta, teamId: "team-1", expectedVersion: 1, name: "New" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });

  it.each([
    ["ACTIVATE", "DRAFT", "ACTIVE", "TEAM_ACTIVATED"],
    ["DEACTIVATE", "ACTIVE", "INACTIVE", "TEAM_DEACTIVATED"],
    ["REACTIVATE", "INACTIVE", "ACTIVE", "TEAM_REACTIVATED"],
  ] as const)("executes %s through the declared lifecycle matrix", async (action, current, expected, outcome) => {
    const currentTeam: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew", status: current, primarySupervisorWorkerId: null, version: 1 };
    const { service, workforce } = harness(currentTeam);
    await expect(service.transition({ ...meta, teamId: "team-1", expectedVersion: 1, action })).resolves.toMatchObject({ outcomeCode: outcome, version: 2 });
    expect(workforce.updateTeam).toHaveBeenCalledWith(expect.objectContaining({ status: expected }));
  });

  it("fails closed for missing Provider, inactive membership, stale Team, and invalid activation", async () => {
    const missing = harness();
    missing.workforce.lockProvider.mockResolvedValueOnce(null as never);
    await expect(missing.service.transition({ ...meta, teamId: "team-1", expectedVersion: 1, action: "ACTIVATE" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });

    const denied = harness(undefined, { manager: false });
    await expect(denied.service.createDraft({ ...meta, expectedVersion: 3, name: "North" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });

    const stale = harness();
    stale.workforce.lockTeam.mockResolvedValueOnce({ id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew", status: "DRAFT", primarySupervisorWorkerId: null, version: 2 });
    await expect(stale.service.replaceName({ ...meta, teamId: "team-1", expectedVersion: 1, name: "South" })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    const noCleaner = harness();
    noCleaner.workforce.listCurrentTeamMembers.mockResolvedValueOnce([]);
    await expect(noCleaner.service.transition({ ...meta, teamId: "team-1", expectedVersion: 1, action: "ACTIVATE" })).rejects.toMatchObject({ code: "WORKFORCE_TEAM_ACTIVATION_INVALID" });
  });
});
