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

function context(members: readonly TeamMemberSnapshot[]) {
  return { workforce: { listCurrentTeamMembers: vi.fn(async () => members) } } as unknown as ProvidersWorkforceTransactionContext;
}

describe("locked final-cleaner impact evaluator", () => {
  it("returns no impact for inactive Teams, ineligible memberships, and multiple valid cleaners", async () => {
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team: { ...team, status: "INACTIVE" }, membership, actorIsPrimarySupervisor: false, confirmed: false })).resolves.toMatchObject({ teamWillBecomeInactive: false });
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team, membership: { ...membership, cleans: false }, actorIsPrimarySupervisor: false, confirmed: false })).resolves.toMatchObject({ teamWillBecomeInactive: false });
    const second = { ...membership, id: "membership-2", workerId: "worker-2", worker: { ...worker, id: "worker-2", identityUserId: "user-2" } };
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership, second]), team, membership, actorIsPrimarySupervisor: false, confirmed: false })).resolves.toMatchObject({ teamWillBecomeInactive: false });
  });

  it("denies Supervisor authority and requires exact Owner/Admin confirmation versions", async () => {
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team, membership, actorIsPrimarySupervisor: true, confirmed: true, expectedTeamVersion: 3, expectedMembershipVersion: 2 })).rejects.toMatchObject({ code: "WORKFORCE_FINAL_CLEANER_CONFLICT", safeDetails: { teamId: "team-1", teamWillBecomeInactive: true } });
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team, membership, actorIsPrimarySupervisor: false, confirmed: false, expectedTeamVersion: 3, expectedMembershipVersion: 2 })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team, membership, actorIsPrimarySupervisor: false, confirmed: true, expectedTeamVersion: 2, expectedMembershipVersion: 2 })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team, membership, actorIsPrimarySupervisor: false, confirmed: true, expectedTeamVersion: 3, expectedMembershipVersion: 1 })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    await expect(evaluateLockedTeamCleanerImpact({ context: context([membership]), team, membership, actorIsPrimarySupervisor: false, confirmed: true, expectedTeamVersion: 3, expectedMembershipVersion: 2 })).resolves.toEqual({ teamId: "team-1", teamVersion: 3, membershipId: "membership-1", membershipVersion: 2, teamWillBecomeInactive: true });
  });
});
