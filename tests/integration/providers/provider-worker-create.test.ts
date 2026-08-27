
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceService } from "../../../src/modules/providers/provider-workforce.service.js";

const worker: WorkerSnapshot = {
  id: "worker-1",
  providerId: "provider-1",
  identityUserId: null,
  predecessorWorkerId: null,
  status: "DRAFT",
  version: 1,
  acceptedInvitationLocale: null,
  endedAt: null,
  profile: {
    fullLegalName: "Synthetic Worker",
    gender: "FEMALE",
    operationalPhoneE164: "+201012345678",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: false,
    skills: ["Deep Cleaning"],
    avatarMediaFileId: null,
    version: 1,
  },
  access: null,
};

function createHarness(level: "OWNER" | "ADMIN" | null = "OWNER", replay = false) {
  const team: TeamSnapshot = {
    id: "team-1",
    providerId: "provider-1",
    name: "North",
    normalizedName: "north",
    status: "ACTIVE",
    primarySupervisorWorkerId: null,
    version: 1,
  };
  const createWorker = vi.fn(async () => worker);
  const getWorker = vi.fn(async () => worker);
  const replaceWorkerProfile = vi.fn(async () => ({
    ...worker,
    version: 2,
    profile: { ...worker.profile, version: 2, displayTitle: "Lead Cleaner" },
  }));
  const getCurrentMembershipForWorker = vi.fn<() => Promise<TeamMemberSnapshot | null>>(async () => null);
  const appendHistory = vi.fn(async () => ({ id: "history-1" }));
  const appendAudit = vi.fn(async () => ({ id: "audit-1", createdAt: new Date().toISOString() }));
  const accept = vi.fn(async () => undefined);
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 3 })),
      readActorMembership: vi.fn(async () => level === null ? null : ({ level, active: true, version: 1 })),
      createWorker,
      getWorker,
      lockWorker: vi.fn(async () => worker),
      replaceWorkerProfile,
      getCurrentMembershipForWorker,
      lockTeam: vi.fn(async () => team),
      getMembership: vi.fn(async () => getCurrentMembershipForWorker()),
    },
    commands: {
      begin: vi.fn(async () => replay
        ? { replay: true, result: { targetId: worker.id, workerVersion: 1, profileVersion: 1 } }
        : { replay: false, result: null }),
      accept,
    },
    history: { append: appendHistory },
    notifications: { insert: vi.fn(async () => undefined) },
    audit: { append: appendAudit },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
    run: async (callback) => callback(context),
  };
  const service = new ProviderWorkforceService({
    unitOfWork,
    createId: () => "worker-1",
  });
  return { service, createWorker, getWorker, replaceWorkerProfile, getCurrentMembershipForWorker, appendHistory, appendAudit, accept };
}

const command = {
  actorUserId: "owner-1",
  providerId: "provider-1",
  requestId: "00000000-0000-4000-8000-000000000101",
  idempotencyKey: "00000000-0000-4000-8000-000000000102",
  expectedVersion: 3,
  profile: {
    fullLegalName: "Synthetic Worker",
    gender: "female" as const,
    operationalPhoneE164: "+201012345678",
    workerType: "CLEANING_STAFF" as const,
    displayTitle: null,
    supervisorCapable: false,
    skillTags: ["Deep Cleaning"],
  },
};

describe("Provider Worker draft creation", () => {
  it.each(["OWNER", "ADMIN"] as const)("allows an active exact-Provider %s", async (level) => {
    const harness = createHarness(level);
    const result = await harness.service.createWorkerDraft(command);
    expect(result.operationalPhoneE164).toBe("+201012345678");
    expect(result.worker).not.toHaveProperty("operationalPhoneE164");
    expect(harness.createWorker).toHaveBeenCalledWith(expect.objectContaining({
      expectedProviderVersion: 3,
      workerId: "worker-1",
    }));
    expect(harness.appendHistory).toHaveBeenCalledTimes(2);
    expect(harness.appendAudit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(harness.appendHistory.mock.calls)).not.toContain("+201012345678");
    expect(JSON.stringify(harness.appendAudit.mock.calls)).not.toContain("+201012345678");
  });

  it("denies a missing/cross-Provider membership before product writes", async () => {
    const harness = createHarness(null);
    await expect(harness.service.createWorkerDraft(command)).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });
    expect(harness.createWorker).not.toHaveBeenCalled();
    expect(harness.appendHistory).not.toHaveBeenCalled();
    expect(harness.appendAudit).not.toHaveBeenCalled();
  });

  it("replays the accepted safe target without duplicating evidence", async () => {
    const harness = createHarness("OWNER", true);
    const result = await harness.service.createWorkerDraft(command);
    expect(result.worker.workerId).toBe("worker-1");
    expect(harness.getWorker).toHaveBeenCalledWith("provider-1", "worker-1");
    expect(harness.createWorker).not.toHaveBeenCalled();
    expect(harness.appendHistory).not.toHaveBeenCalled();
    expect(harness.appendAudit).not.toHaveBeenCalled();
    expect(harness.accept).not.toHaveBeenCalled();
  });

  it("replaces the routine profile with profile-version CAS and no reason", async () => {
    const harness = createHarness("ADMIN");
    const result = await harness.service.replaceWorkerProfile({
      ...command,
      workerId: worker.id,
      expectedVersion: 1,
      profile: { ...command.profile, displayTitle: " Lead   Cleaner " },
    });
    expect(result.worker.profileVersion).toBe(2);
    expect(harness.replaceWorkerProfile).toHaveBeenCalledWith(expect.objectContaining({
      expectedProfileVersion: 1,
      profile: expect.objectContaining({ displayTitle: "Lead Cleaner" }),
    }));
    expect(JSON.stringify(harness.appendHistory.mock.calls)).not.toContain("+201012345678");
  });

  it("rejects Cleaner-to-Escort while the current membership still cleans", async () => {
    const harness = createHarness("OWNER");
    harness.getCurrentMembershipForWorker.mockResolvedValue({
      id: "membership-1", teamId: "team-1", workerId: worker.id, cleans: true,
      version: 1, endedAt: null, worker,
    });
    await expect(harness.service.replaceWorkerProfile({
      ...command,
      workerId: worker.id,
      expectedVersion: 1,
      profile: { ...command.profile, workerType: "ESCORT" },
    })).rejects.toMatchObject({ code: "WORKFORCE_ESCORT_MEMBERSHIP_CONFLICT" });
    expect(harness.replaceWorkerProfile).not.toHaveBeenCalled();
  });
});
