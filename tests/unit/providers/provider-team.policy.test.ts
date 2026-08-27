
import {
  assertTeamActivation,
  assertTeamTransition,
  normalizeDisplayLabel,
  normalizeWorkforceLabel,
} from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import type { TeamMemberSnapshot, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 1, acceptedInvitationLocale: "EN", endedAt: null,
  profile: {
    fullLegalName: "Team Worker", gender: "MALE", operationalPhoneE164: "+201011111111",
    workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: [],
    avatarMediaFileId: null, version: 1,
  },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const member: TeamMemberSnapshot = {
  id: "membership-1", teamId: "team-1", workerId: worker.id, cleans: true,
  version: 1, endedAt: null, worker,
};

describe("Provider Team policy", () => {
  it("implements only DRAFT -> ACTIVE <-> INACTIVE -> ARCHIVED", () => {
    for (const [from, to] of [
      ["DRAFT", "ACTIVE"], ["ACTIVE", "INACTIVE"], ["INACTIVE", "ACTIVE"], ["INACTIVE", "ARCHIVED"],
    ] as const) expect(() => assertTeamTransition(from, to)).not.toThrow();

    for (const [from, to] of [
      ["DRAFT", "INACTIVE"], ["ACTIVE", "ARCHIVED"], ["ARCHIVED", "ACTIVE"], ["ARCHIVED", "INACTIVE"],
    ] as const) expect(() => assertTeamTransition(from, to)).toThrowError(expect.objectContaining({ code: "WORKFORCE_INVALID_TEAM_TRANSITION" }));
  });

  it("normalizes display and uniqueness names deterministically", () => {
    expect(normalizeDisplayLabel("  North   Crew ")).toBe("North Crew");
    expect(normalizeWorkforceLabel("  NORTH   Crew ")).toBe("north crew");
    expect(normalizeWorkforceLabel("north crew")).toBe(normalizeWorkforceLabel(" NORTH   CREW "));
  });

  it("requires a nonblank name and one current active cleaning staff member for activation", () => {
    expect(() => assertTeamActivation("North Crew", [member])).not.toThrow();
    expect(() => assertTeamActivation(null, [member])).toThrowError(expect.objectContaining({ code: "WORKFORCE_TEAM_ACTIVATION_INVALID" }));
    expect(() => assertTeamActivation("North Crew", [{ ...member, cleans: false }])).toThrowError(expect.objectContaining({ code: "WORKFORCE_TEAM_ACTIVATION_INVALID" }));
    expect(() => assertTeamActivation("North Crew", [{ ...member, worker: { ...worker, status: "INACTIVE" } }])).toThrowError(expect.objectContaining({ code: "WORKFORCE_TEAM_ACTIVATION_INVALID" }));
    expect(() => assertTeamActivation("North Crew", [{ ...member, worker: { ...worker, profile: { ...worker.profile, workerType: "ESCORT" } } }])).toThrowError(expect.objectContaining({ code: "WORKFORCE_TEAM_ACTIVATION_INVALID" }));
  });
});
