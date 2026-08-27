
import type { ProvidersWorkforceTransactionContext, ProvidersWorkforceUnitOfWorkPort, TeamMemberSnapshot, TeamSnapshot, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderTeamService } from "../../../src/modules/providers/provider-team.service.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 7, acceptedInvitationLocale: "AR", endedAt: null,
  profile: { fullLegalName: "Archive Worker", gender: "FEMALE", operationalPhoneE164: "+201011111111", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [], avatarMediaFileId: null, version: 2 },
  access: { status: "ACTIVE", version: 2, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "Archive Crew", normalizedName: "archive crew", status: "INACTIVE", primarySupervisorWorkerId: worker.id, version: 5 };
const member: TeamMemberSnapshot = { id: "membership-1", teamId: team.id, workerId: worker.id, cleans: true, version: 2, endedAt: null, worker };

describe("Provider Team archive", () => {
  it("ends all current memberships, clears Supervisor, and never changes Worker lifecycle", async () => {
    let currentTeam = team;
    const updateMembership = vi.fn(async () => ({ ...member, version: 3, endedAt: new Date("2026-08-22T17:00:00.000Z") }));
    const updateTeam = vi.fn(async () => {
      currentTeam = { ...currentTeam, status: "ARCHIVED", primarySupervisorWorkerId: null, version: 6 };
      return currentTeam;
    });
    const context = {
      workforce: {
        lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
        readActorMembership: vi.fn(async () => ({ level: "OWNER" as const, active: true, version: 1 })),
        getTeam: vi.fn(async () => currentTeam),
        lockWorker: vi.fn(async () => worker),
        lockTeam: vi.fn(async () => currentTeam),
        listCurrentTeamMembers: vi.fn(async () => [member]),
        updateMembership,
        updateTeam,
        countPrimarySupervisorAssignments: vi.fn(async () => 0),
      },
      identityAuthority: { reconcileProviderSupervisorRole: vi.fn(async () => undefined) },
      commands: { begin: vi.fn(async () => ({ replay: false, result: null })), accept: vi.fn(async () => undefined) },
      history: { append: vi.fn(async () => ({ id: "history-1" })) },
      audit: { append: vi.fn(async () => ({ auditLogId: "audit-1" })) },
    } as unknown as ProvidersWorkforceTransactionContext;
    const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
    const service = new ProviderTeamService({ unitOfWork, now: () => new Date("2026-08-22T17:00:00.000Z") });
    const result = await service.transition({
      actorUserId: "owner-1", providerId: "provider-1", teamId: team.id, action: "ARCHIVE",
      requestId: "00000000-0000-4000-8000-000000000821",
      idempotencyKey: "00000000-0000-4000-8000-000000000822", expectedVersion: 5,
    });
    expect(result.outcomeCode).toBe("TEAM_ARCHIVED");
    expect(updateMembership).toHaveBeenCalledWith(expect.objectContaining({ membershipId: member.id, endedAt: expect.any(Date) }));
    expect(updateTeam).toHaveBeenCalledWith(expect.objectContaining({ status: "ARCHIVED", primarySupervisorWorkerId: null }));
    expect(worker).toMatchObject({ status: "ACTIVE", version: 7 });
    expect(context.identityAuthority.reconcileProviderSupervisorRole).toHaveBeenCalledWith({ userId: "user-1", shouldBeEnabled: false });
  });
});
