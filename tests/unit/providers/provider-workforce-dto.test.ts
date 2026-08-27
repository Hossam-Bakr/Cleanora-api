import type { TeamMemberSnapshot, TeamSnapshot, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import {
  assertSafeWorkforceFacts,
  mapBookingSafeMemberFact,
  mapTeamDto,
  mapWorkerListItem,
  mapWorkerPrivateDto,
  mapWorkerSelfDto,
  mapWorkerSupervisorDto,
  sanitizeHistoryFacts,
} from "../../../src/modules/providers/provider-workforce.dto.js";

const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
  status: "ACTIVE", version: 2, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: "Worker One", gender: "MALE", operationalPhoneE164: "+201000000001", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: true, skills: ["Windows"], avatarMediaFileId: null, version: 1 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};
const member: TeamMemberSnapshot = { id: "membership-1", teamId: "team-1", workerId: worker.id, cleans: true, version: 1, endedAt: null, worker };
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "North Crew", normalizedName: "north crew", status: "ACTIVE", primarySupervisorWorkerId: worker.id, version: 3 };

describe("R1-P07 role-specific DTO allowlists", () => {
  it("maps management, Supervisor, self, Booking, and Team views with only their declared fields", () => {
    expect(mapWorkerListItem(worker, "team-1")).toMatchObject({ gender: "male", currentTeamId: "team-1" });
    expect(mapWorkerListItem({ ...worker, profile: { ...worker.profile, gender: "FEMALE" } })).toMatchObject({ gender: "female", currentTeamId: null });
    expect(mapWorkerPrivateDto(worker, { url: "https://example.invalid/signed", expiresAt: "2026-08-23T12:00:00.000Z" })).toMatchObject({
      viewScope: "PROVIDER_MANAGEMENT", loginAccessStatus: "ACTIVE", avatar: { url: expect.any(String) },
    });
    expect(mapWorkerPrivateDto({ ...worker, access: null })).toMatchObject({ loginAccessStatus: null, avatar: null });
    expect(mapWorkerSupervisorDto(worker, member)).toMatchObject({ viewScope: "PRIMARY_SUPERVISOR", gender: "male", cleans: true });
    expect(mapWorkerSupervisorDto({ ...worker, profile: { ...worker.profile, gender: "FEMALE" } }, { ...member, worker: { ...worker, profile: { ...worker.profile, gender: "FEMALE" } } })).toMatchObject({ gender: "female" });
    expect(mapWorkerSelfDto(worker)).toMatchObject({ viewScope: "SELF", operationalPhoneE164: "+201000000001" });
    expect(mapBookingSafeMemberFact(member)).toEqual({ workerId: "worker-1", gender: "male", workerType: "CLEANING_STAFF", cleans: true });
    expect(mapBookingSafeMemberFact({ ...member, worker: { ...worker, profile: { ...worker.profile, gender: "FEMALE" } } })).toMatchObject({ gender: "female" });
    expect(mapTeamDto(team, [member])).toMatchObject({ id: "team-1", members: [{ id: "membership-1", workerId: "worker-1" }] });
  });

  it("accepts only recursive safe history facts and preserves undefined meaning", () => {
    expect(() => assertSafeWorkforceFacts(null)).not.toThrow();
    expect(() => assertSafeWorkforceFacts("primitive")).not.toThrow();
    expect(sanitizeHistoryFacts(undefined)).toBeUndefined();
    expect(sanitizeHistoryFacts({ status: "ACTIVE", version: 2, teamId: null })).toEqual({ status: "ACTIVE", version: 2, teamId: null });
    expect(() => assertSafeWorkforceFacts({ nested: { emailAddress: "worker@example.invalid" } })).toThrowError(expect.objectContaining({ code: "WORKFORCE_HISTORY_UNSAFE" }));
    expect(() => assertSafeWorkforceFacts({ storage_key: "private/avatar" })).toThrowError(expect.objectContaining({ code: "WORKFORCE_HISTORY_UNSAFE" }));
  });
});
