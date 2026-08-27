
import type { ProvidersWorkforceTransactionContext, TeamMemberSnapshot, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceReadinessService } from "../../../src/modules/providers/provider-workforce-readiness.service.js";

const worker = (id: string, workerType: WorkerSnapshot["profile"]["workerType"], gender: WorkerSnapshot["profile"]["gender"]): WorkerSnapshot => ({
  id, providerId: "provider-1", identityUserId: `${id}-user`, predecessorWorkerId: null, status: "ACTIVE", version: 1, acceptedInvitationLocale: "EN", endedAt: null,
  profile: { fullLegalName: id, gender, operationalPhoneE164: "+201011111111", workerType, displayTitle: null, supervisorCapable: false, skills: ["private-skill"], avatarMediaFileId: null, version: 1 },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
});

describe("booking-safe crew composition contract", () => {
  it("exposes only current gender/type/membership cleaning facts and never creates a Booking assignment", async () => {
    const cleaner = worker("cleaner-1", "CLEANING_STAFF", "FEMALE");
    const escort = worker("escort-1", "ESCORT", "MALE");
    const members: TeamMemberSnapshot[] = [
      { id: "membership-1", teamId: "team-1", workerId: cleaner.id, cleans: true, version: 1, endedAt: null, worker: cleaner },
      { id: "membership-2", teamId: "team-1", workerId: escort.id, cleans: false, version: 1, endedAt: null, worker: escort },
    ];
    const context = {
      workforce: {
        lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
        getTeam: vi.fn(async () => ({ id: "team-1", providerId: "provider-1", name: "Crew", normalizedName: "crew", status: "ACTIVE", primarySupervisorWorkerId: null, version: 3 })),
        listCurrentTeamMembers: vi.fn(async () => members),
      },
    } as unknown as ProvidersWorkforceTransactionContext;
    const service = new ProviderWorkforceReadinessService({ run: async (callback) => callback(context) });
    const result = await service.getBookingSafeTeamFacts({ providerId: "provider-1", teamId: "team-1" });
    expect(result).toEqual({
      providerId: "provider-1",
      teamId: "team-1",
      teamVersion: 3,
      active: true,
      members: [
        { workerId: cleaner.id, gender: "female", workerType: "CLEANING_STAFF", cleans: true },
        { workerId: escort.id, gender: "male", workerType: "ESCORT", cleans: false },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/(?:phone|email|skill|identity|access|bookingId|assignment)/iu);
    expect(context).not.toHaveProperty("booking");
  });
});
