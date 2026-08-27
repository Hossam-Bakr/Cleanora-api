import type {
  ProvidersWorkforceTransactionContext,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderTeamQueryService } from "../../../src/modules/providers/provider-team-query.service.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "supervisor-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 2, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Cleaner One", gender: "FEMALE", operationalPhoneE164: "+201000000001", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [], avatarMediaFileId: null, version: 1 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew", status: "ACTIVE", primarySupervisorWorkerId: worker.id, version: 4 };
const member: TeamMemberSnapshot = { id: "membership-1", teamId: team.id, workerId: worker.id, cleans: true, version: 2, endedAt: null, worker };

function harness(options: { readonly manager?: boolean; readonly supervisor?: boolean; readonly teams?: readonly TeamSnapshot[] } = {}) {
  const workforce = {
    readActorMembership: vi.fn(async () => options.manager === false ? null : ({ level: "ADMIN", active: true, version: 1 })),
    listTeams: vi.fn(async () => options.teams ?? [team]),
    listCurrentTeamMembers: vi.fn(async () => [member]),
    getTeam: vi.fn(async (_providerId: string, teamId: string) => teamId === team.id ? team : null),
    getCurrentWorkerByIdentity: vi.fn(async () => options.supervisor === false ? null : worker),
    getCurrentMembershipForWorker: vi.fn(async () => member),
  };
  const history = { list: vi.fn(async () => [{
    id: "history-1", providerId: "provider-1", targetType: "TEAM" as const, targetId: team.id,
    targetVersion: 4, eventCode: "TEAM_ACTIVATED", actorUserId: "admin-1",
    reasonCode: "OPERATIONAL", note: "approved", safeBefore: { status: "DRAFT", version: 3 },
    safeAfter: { status: "ACTIVE", version: 4 }, requestId: "request-1", createdAt: new Date("2026-08-23T09:00:00.000Z"),
  }]) };
  const context = { workforce, history } as unknown as ProvidersWorkforceTransactionContext;
  const service = new ProviderTeamQueryService({ run: async (callback) => callback(context) });
  return { service, workforce, history };
}

describe("Provider Team role-scoped queries", () => {
  it("returns a bounded manager list with cleaner counts and pagination", async () => {
    const second = { ...team, id: "team-2", name: null, normalizedName: null };
    const { service, workforce } = harness({ teams: [team, second] });
    await expect(service.list({ actorUserId: "admin-1", providerId: "provider-1", limit: 1, cursor: "cursor-1" })).resolves.toEqual({
      items: [expect.objectContaining({ teamId: "team-1", currentMemberCount: 1, validCleanerCount: 1 })],
      nextCursor: "team-1",
    });
    expect(workforce.listTeams).toHaveBeenCalledWith("provider-1", 2, "cursor-1");
  });

  it("limits a primary Supervisor to the exact current Team and rejects scope loss", async () => {
    const scoped = harness({ manager: false, supervisor: true });
    await expect(scoped.service.list({ actorUserId: "supervisor-1", providerId: "provider-1" })).resolves.toMatchObject({
      items: [{ teamId: "team-1" }], nextCursor: null,
    });
    const detail = await scoped.service.get({ actorUserId: "supervisor-1", providerId: "provider-1", teamId: "team-1" });
    expect(detail).toMatchObject({ team: { teamId: "team-1" }, members: [{ membershipId: "membership-1" }] });
    expect(detail.members[0]).not.toHaveProperty("operationalPhoneE164");

    const lost = harness({ manager: false, supervisor: false });
    await expect(lost.service.list({ actorUserId: "supervisor-1", providerId: "provider-1" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
    await expect(lost.service.get({ actorUserId: "supervisor-1", providerId: "provider-1", teamId: "team-1" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
  });

  it("returns manager-only immutable Team history and non-enumerates denied/missing targets", async () => {
    const managed = harness();
    await expect(managed.service.history({
      actorUserId: "admin-1", providerId: "provider-1", teamId: "team-1", limit: 1, cursor: "history-cursor",
    })).resolves.toEqual({
      items: [expect.objectContaining({ historyId: "history-1", createdAt: "2026-08-23T09:00:00.000Z" })],
      nextCursor: null,
    });
    expect(managed.history.list).toHaveBeenCalledWith(expect.objectContaining({ cursor: "history-cursor", limit: 2 }));

    const denied = harness({ manager: false, supervisor: true });
    await expect(denied.service.history({ actorUserId: "supervisor-1", providerId: "provider-1", teamId: "team-1" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
    managed.workforce.getTeam.mockResolvedValueOnce(null);
    await expect(managed.service.history({ actorUserId: "admin-1", providerId: "provider-1", teamId: "missing" })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
  });
});
