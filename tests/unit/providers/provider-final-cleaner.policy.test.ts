
import type { ProvidersWorkforceTransactionContext, TeamMemberSnapshot, TeamSnapshot, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { evaluateLockedTeamCleanerImpact } from "../../../src/modules/providers/provider-workforce-impact.service.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 1, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Cleaner", gender: "FEMALE", operationalPhoneE164: "+201000000001", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [], avatarMediaFileId: null, version: 1 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "Crew", normalizedName: "crew", status: "ACTIVE", primarySupervisorWorkerId: worker.id, version: 3 };
const membership: TeamMemberSnapshot = { id: "membership-1", teamId: team.id, workerId: worker.id, cleans: true, version: 2, endedAt: null, worker };
const context = { workforce: { listCurrentTeamMembers: vi.fn(async () => [membership]) } } as unknown as ProvidersWorkforceTransactionContext;

describe("primary Supervisor final-cleaner policy", () => {
  it("always denies the Supervisor with safe Team-only details and ignores a submitted confirmation", async () => {
    await expect(evaluateLockedTeamCleanerImpact({
      context, team, membership, actorIsPrimarySupervisor: true, confirmed: true,
      expectedTeamVersion: team.version, expectedMembershipVersion: membership.version,
    })).rejects.toEqual(expect.objectContaining({
      code: "WORKFORCE_FINAL_CLEANER_CONFLICT",
      safeDetails: { teamId: team.id, teamVersion: team.version, teamWillBecomeInactive: true },
    }));
    const error = await evaluateLockedTeamCleanerImpact({
      context, team, membership, actorIsPrimarySupervisor: true, confirmed: false,
    }).catch((value: unknown) => value);
    expect(JSON.stringify(error)).not.toMatch(/(?:phone|identity|email|proof|token|credential)/iu);
  });
});
