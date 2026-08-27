import { PrismaProviderWorkforceRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-workforce.repository.js";

const at = new Date("2026-08-23T07:00:00.000Z");

const profileRow = {
  workerId: "worker-1",
  fullLegalName: " Worker One ",
  gender: "FEMALE",
  operationalPhoneE164: "+201000000001",
  workerType: "CLEANING_STAFF",
  displayTitle: "Cleaner",
  supervisorCapable: true,
  avatarMediaFileId: null,
  version: 1,
};

const accessRow = {
  workerId: "worker-1",
  status: "ACTIVE",
  version: 1,
  currentInvitationId: "invitation-1",
};

const workerRow = {
  id: "worker-1",
  providerId: "provider-1",
  identityUserId: "user-1",
  predecessorWorkerId: null,
  status: "ACTIVE",
  version: 1,
  acceptedInvitationLocale: "EN",
  endedAt: null,
  updatedAt: at,
  profile: profileRow,
  loginAccess: accessRow,
  skills: [{ normalizedLabel: "deep cleaning", displayLabel: "Deep Cleaning" }],
};

const invitationRow = {
  id: "invitation-1",
  workerId: "worker-1",
  invitationVersion: 1,
  emailNormalized: "worker@example.invalid",
  locale: "EN",
  status: "PENDING",
  version: 1,
  issuedByUserId: "owner-1",
  acceptedByUserId: null,
  issuedAt: at,
  expiresAt: new Date(at.getTime() + 86_400_000),
  acceptedAt: null,
  revokedAt: null,
  expiredAt: null,
  supersededAt: null,
};

const teamRow = {
  id: "team-1",
  providerId: "provider-1",
  name: "Team One",
  normalizedName: "team one",
  status: "ACTIVE",
  primarySupervisorWorkerId: "worker-1",
  version: 1,
};

const membershipRow = {
  id: "membership-1",
  teamId: "team-1",
  workerId: "worker-1",
  cleans: true,
  version: 1,
  endedAt: null,
  worker: workerRow,
};

function makeDb() {
  return {
    $queryRaw: vi.fn(async (): Promise<unknown[]> => []),
    provider: {
      findUnique: vi.fn(async () => ({ ownerUserId: "owner-1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    providerWorker: {
      findFirst: vi.fn(async () => workerRow),
      findMany: vi.fn(async () => [workerRow]),
      create: vi.fn(async () => workerRow),
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 1),
    },
    providerWorkerProfile: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    providerWorkerSkill: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    providerWorkerLoginAccess: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => accessRow),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    providerMember: {
      findUnique: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => ({
        id: "member-1", providerId: "provider-1", userId: "user-1", level: "ADMIN", status: "ACTIVE", version: 2,
      })),
      create: vi.fn(async () => ({
        id: "member-1", providerId: "provider-1", userId: "user-1", level: "ADMIN", status: "ACTIVE", version: 1,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 1),
    },
    providerWorkerInvitation: {
      findUnique: vi.fn(async () => invitationRow),
      findFirst: vi.fn(async () => invitationRow),
      create: vi.fn(async () => invitationRow),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    providerTeam: {
      findFirst: vi.fn(async () => teamRow),
      findMany: vi.fn(async () => [teamRow]),
      create: vi.fn(async () => teamRow),
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 1),
    },
    providerTeamMembership: {
      findFirst: vi.fn(async () => membershipRow),
      findMany: vi.fn(async () => [membershipRow]),
      findUnique: vi.fn(async () => membershipRow),
      create: vi.fn(async () => membershipRow),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

describe("R1-P07 Prisma workforce aggregate repository", () => {
  it("locks and maps Provider, Worker, invitation, Team, membership, and readiness reads", async () => {
    const db = makeDb();
    const repository = new PrismaProviderWorkforceRepository(db as never);

    db.$queryRaw.mockResolvedValueOnce([{ id: "provider-1", workforce_state_version: 7 }]);
    await expect(repository.lockProvider("provider-1")).resolves.toEqual({ id: "provider-1", workforceStateVersion: 7 });
    await expect(repository.getProviderOwnerUserId("provider-1")).resolves.toBe("owner-1");
    db.$queryRaw.mockResolvedValueOnce([{ level: "OWNER", status: "ACTIVE", version: 3 }]);
    await expect(repository.readActorMembership("provider-1", "owner-1")).resolves.toEqual({ level: "OWNER", active: true, version: 3 });

    db.$queryRaw
      .mockResolvedValueOnce([{ id: "worker-1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await expect(repository.lockWorker("provider-1", "worker-1")).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.getWorker("provider-1", "worker-1")).resolves.toMatchObject({
      id: "worker-1", profile: { skills: ["Deep Cleaning"] }, access: { status: "ACTIVE" },
    });
    await expect(repository.getCurrentWorkerByIdentity("user-1")).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.getLatestWorkerByIdentity("user-1")).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.getLatestRemovedWorkerByIdentity("provider-1", "user-1")).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.listWorkers("provider-1", 20, "cursor-1")).resolves.toHaveLength(1);
    expect(db.providerWorker.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: "cursor-1" }, skip: 1 }));
    await expect(repository.getCurrentMembershipForWorker("worker-1")).resolves.toMatchObject({ id: "membership-1" });
    await expect(repository.listReadinessCandidates("provider-1")).resolves.toHaveLength(1);
    await expect(repository.countActiveAccessForIdentity("user-1")).resolves.toBe(1);

    db.$queryRaw.mockResolvedValueOnce([{
      id: "member-1", provider_id: "provider-1", user_id: "user-1", level: "ADMIN", status: "DISABLED", version: 2,
    }]);
    await expect(repository.lockProviderMember("provider-1", "user-1")).resolves.toEqual({
      id: "member-1", providerId: "provider-1", userId: "user-1", level: "ADMIN", active: false, version: 2,
    });
    await expect(repository.countActiveAdminMemberships("user-1")).resolves.toBe(1);
    await expect(repository.getInvitation("invitation-1")).resolves.toMatchObject({ id: "invitation-1", locale: "EN" });
    db.providerWorkerInvitation.findUnique.mockResolvedValueOnce({ ...invitationRow, worker: workerRow } as never);
    await expect(repository.getWorkerForInvitation("invitation-1")).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.getLatestInvitation("worker-1")).resolves.toMatchObject({ id: "invitation-1" });

    await expect(repository.getTeam("provider-1", "team-1")).resolves.toEqual(teamRow);
    db.$queryRaw.mockResolvedValueOnce([{
      id: "team-1", provider_id: "provider-1", name: "Team One", normalized_name: "team one",
      status: "ACTIVE", primary_supervisor_worker_id: "worker-1", version: 1,
    }]);
    await expect(repository.lockTeam("provider-1", "team-1")).resolves.toEqual(teamRow);
    await expect(repository.listTeams("provider-1", 20, "team-cursor")).resolves.toEqual([teamRow]);
    await expect(repository.listCurrentTeamMembers("team-1")).resolves.toMatchObject([{ id: "membership-1" }]);
    db.$queryRaw.mockResolvedValueOnce([{ id: "membership-1" }]);
    await expect(repository.getMembership("team-1", "membership-1")).resolves.toMatchObject({ id: "membership-1" });
    await expect(repository.countPrimarySupervisorAssignments("user-1")).resolves.toBe(1);
  });

  it("performs Worker profile, avatar, lifecycle, access, and Admin membership CAS mutations", async () => {
    const db = makeDb();
    const repository = new PrismaProviderWorkforceRepository(db as never);
    const profile = {
      fullLegalName: " Worker One ", gender: "FEMALE", operationalPhoneE164: "+201000000001",
      workerType: "CLEANING_STAFF", displayTitle: "Cleaner", supervisorCapable: true,
      skills: [" Deep Cleaning ", "Windows"],
    };

    await expect(repository.createWorker({
      workerId: "worker-1", providerId: "provider-1", expectedProviderVersion: 1,
      predecessorWorkerId: null, profile,
    } as never)).resolves.toMatchObject({ id: "worker-1" });
    expect(db.providerWorker.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ profile: { create: expect.objectContaining({ fullLegalName: "Worker One" }) } }),
    }));

    await expect(repository.replaceWorkerProfile({
      providerId: "provider-1", workerId: "worker-1", expectedVersion: 1, expectedProfileVersion: 1, profile,
    } as never)).resolves.toMatchObject({ id: "worker-1" });
    expect(db.providerWorkerSkill.deleteMany).toHaveBeenCalled();
    expect(db.providerWorkerSkill.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ normalizedLabel: "deep cleaning" }),
      expect.objectContaining({ normalizedLabel: "windows" }),
    ]) });

    await expect(repository.setWorkerAvatar({
      providerId: "provider-1", workerId: "worker-1", expectedProfileVersion: 1, mediaFileId: "media-1",
    } as never)).resolves.toMatchObject({ profile: { avatarMediaFileId: null } });
    await expect(repository.setWorkerStatus({
      providerId: "provider-1", workerId: "worker-1", expectedVersion: 1, status: "INACTIVE", endedAt: at,
    } as never)).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.setWorkerAccessStatus({
      providerId: "provider-1", workerId: "worker-1", expectedAccessVersion: 1, status: "ACTIVE", transitionedAt: at,
    } as never)).resolves.toMatchObject({ id: "worker-1" });
    await expect(repository.setWorkerAccessStatus({
      providerId: "provider-1", workerId: "worker-1", expectedAccessVersion: 1, status: "REVOKED", transitionedAt: at,
    } as never)).resolves.toMatchObject({ id: "worker-1" });

    await expect(repository.setProviderAdminMembership({
      providerId: "provider-1", userId: "user-1", actorUserId: "owner-1", active: true,
      expectedMembershipVersion: null, changedAt: at,
    } as never)).resolves.toMatchObject({ active: true, version: 1 });
    db.providerMember.findUnique.mockResolvedValueOnce({ level: "ADMIN", version: 1 } as never);
    await expect(repository.setProviderAdminMembership({
      providerId: "provider-1", userId: "user-1", actorUserId: "owner-1", active: false,
      expectedMembershipVersion: 1, changedAt: at,
    } as never)).resolves.toMatchObject({ active: true, version: 2 });
  });

  it("issues, transitions, and accepts invitation versions atomically", async () => {
    const db = makeDb();
    const repository = new PrismaProviderWorkforceRepository(db as never);
    const issue = {
      providerId: "provider-1", workerId: "worker-1", expectedWorkerVersion: 1,
      expectedAccessVersion: null, invitationId: "invitation-1", invitationVersion: 1,
      emailNormalized: "worker@example.invalid", locale: "EN", actorUserId: "owner-1",
      issuedAt: at, expiresAt: invitationRow.expiresAt,
    } as const;
    await expect(repository.issueInvitation(issue as never)).resolves.toMatchObject({
      worker: { id: "worker-1" }, invitation: { id: "invitation-1" },
    });
    expect(db.providerWorkerLoginAccess.create).toHaveBeenCalled();

    db.providerWorkerLoginAccess.findUnique.mockResolvedValueOnce({ ...accessRow, version: 1 } as never);
    await expect(repository.issueInvitation({ ...issue, invitationId: "invitation-2", invitationVersion: 2, expectedAccessVersion: 1 } as never)).resolves.toBeDefined();
    expect(db.providerWorkerLoginAccess.updateMany).toHaveBeenCalled();

    await expect(repository.transitionInvitation({
      providerId: "provider-1", workerId: "worker-1", invitationId: "invitation-1",
      expectedInvitationVersion: 1, expectedAccessVersion: 1, status: "EXPIRED", transitionedAt: at,
    } as never)).resolves.toMatchObject({ worker: { id: "worker-1" }, invitation: { id: "invitation-1" } });
    await expect(repository.transitionInvitation({
      providerId: "provider-1", workerId: "worker-1", invitationId: "invitation-1",
      expectedInvitationVersion: 1, expectedAccessVersion: 1, status: "REVOKED", transitionedAt: at,
    } as never)).resolves.toBeDefined();

    await expect(repository.acceptInvitation({
      providerId: "provider-1", workerId: "worker-1", invitationId: "invitation-1",
      expectedInvitationVersion: 1, expectedWorkerVersion: 1, expectedAccessVersion: 1,
      identityUserId: "user-1", predecessorWorkerId: null, acceptedLocale: "EN",
      operationalPhoneE164: "+201000000001", acceptedAt: at,
    } as never)).resolves.toMatchObject({ worker: { id: "worker-1" }, invitation: { id: "invitation-1" } });
  });

  it("creates and CAS-updates Teams and memberships while preserving mapped Worker facts", async () => {
    const db = makeDb();
    const repository = new PrismaProviderWorkforceRepository(db as never);
    await expect(repository.createTeam({
      providerId: "provider-1", teamId: "team-1", expectedProviderVersion: 1,
      name: "Team One", normalizedName: "team one",
    } as never)).resolves.toEqual(teamRow);
    await expect(repository.updateTeam({
      providerId: "provider-1", teamId: "team-1", expectedVersion: 1,
      name: "Team Renamed", normalizedName: "team renamed", status: "INACTIVE", primarySupervisorWorkerId: null,
    } as never)).resolves.toEqual(teamRow);
    await expect(repository.addMembership({
      providerId: "provider-1", teamId: "team-1", expectedVersion: 1,
      membershipId: "membership-1", workerId: "worker-1", cleans: true,
    } as never)).resolves.toMatchObject({ id: "membership-1", worker: { id: "worker-1" } });
    await expect(repository.updateMembership({
      providerId: "provider-1", teamId: "team-1", membershipId: "membership-1",
      expectedTeamVersion: 1, expectedMembershipVersion: 1, cleans: false, endedAt: at,
    } as never)).resolves.toMatchObject({ id: "membership-1" });
    await expect(repository.updateMembership({
      providerId: "provider-1", teamId: "team-1", membershipId: "membership-1",
      expectedMembershipVersion: 1, cleans: true,
    } as never)).resolves.toBeDefined();
  });

  it("fails closed for missing locks, absent rows, stale versions, Owner mutation, and invalid invitation state", async () => {
    const db = makeDb();
    const repository = new PrismaProviderWorkforceRepository(db as never);
    await expect(repository.lockProvider("missing")).resolves.toBeNull();
    await expect(repository.readActorMembership("provider-1", "missing")).resolves.toBeNull();
    await expect(repository.lockWorker("provider-1", "missing")).resolves.toBeNull();
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(repository.lockTeam("provider-1", "missing")).resolves.toBeNull();
    db.$queryRaw.mockResolvedValueOnce([]);
    await expect(repository.getMembership("team-1", "missing")).resolves.toBeNull();

    db.provider.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.createWorker({ providerId: "provider-1", workerId: "worker-2", expectedProviderVersion: 0, profile: {} } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db.providerWorker.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.setWorkerStatus({ providerId: "provider-1", workerId: "worker-1", expectedVersion: 0, status: "ACTIVE" } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db.providerMember.findUnique.mockResolvedValueOnce({ level: "OWNER" } as never);
    await expect(repository.setProviderAdminMembership({
      providerId: "provider-1", userId: "owner-1", actorUserId: "owner-1", active: false,
      expectedMembershipVersion: 1, changedAt: at,
    } as never)).rejects.toMatchObject({ code: "WORKFORCE_PERMISSION_DENIED" });
    db.providerWorkerInvitation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.transitionInvitation({
      providerId: "provider-1", workerId: "worker-1", invitationId: "invitation-1",
      expectedInvitationVersion: 0, expectedAccessVersion: 1, status: "REVOKED", transitionedAt: at,
    } as never)).rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    db.provider.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.createTeam({
      providerId: "provider-1", teamId: "team-2", expectedProviderVersion: 0, name: null, normalizedName: null,
    } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });

  it("maps optional/null projections without inventing access, skills, ownership, or resources", async () => {
    const db = makeDb();
    const repository = new PrismaProviderWorkforceRepository(db as never);
    db.provider.findUnique.mockResolvedValueOnce(null as never);
    await expect(repository.getProviderOwnerUserId("missing")).resolves.toBeNull();
    db.providerWorker.findFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ ...workerRow, loginAccess: null, skills: undefined } as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never);
    await expect(repository.getWorker("provider-1", "missing")).resolves.toBeNull();
    await expect(repository.getWorker("provider-1", "worker-1")).resolves.toMatchObject({ access: null, profile: { skills: [] } });
    await expect(repository.getCurrentWorkerByIdentity("missing")).resolves.toBeNull();
    await expect(repository.getLatestWorkerByIdentity("missing")).resolves.toBeNull();
    await expect(repository.getLatestRemovedWorkerByIdentity("provider-1", "missing")).resolves.toBeNull();
    db.providerWorker.findFirst.mockResolvedValueOnce({ ...workerRow, profile: null } as never);
    await expect(repository.getWorker("provider-1", "worker-1")).rejects.toMatchObject({ code: "WORKFORCE_PROFILE_MISSING" });
    db.providerTeamMembership.findFirst.mockResolvedValueOnce(null as never);
    await expect(repository.getCurrentMembershipForWorker("missing")).resolves.toBeNull();
    db.providerWorkerInvitation.findUnique.mockResolvedValueOnce(null as never).mockResolvedValueOnce(null as never);
    await expect(repository.getInvitation("missing")).resolves.toBeNull();
    await expect(repository.getWorkerForInvitation("missing")).resolves.toBeNull();
    db.providerWorkerInvitation.findFirst.mockResolvedValueOnce(null as never);
    await expect(repository.getLatestInvitation("missing")).resolves.toBeNull();
    db.providerTeam.findFirst.mockResolvedValueOnce(null as never);
    await expect(repository.getTeam("provider-1", "missing")).resolves.toBeNull();
  });

  it("rejects stale profile, access, Admin, and invitation mutation boundaries", async () => {
    const profile = { fullLegalName: "Worker", gender: "FEMALE", operationalPhoneE164: "+201000000001", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false, skills: [] };
    let db = makeDb();
    let repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorker.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.replaceWorkerProfile({ providerId: "provider-1", workerId: "worker-1", expectedVersion: 0, expectedProfileVersion: 1, profile } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.replaceWorkerProfile({ providerId: "provider-1", workerId: "worker-1", expectedVersion: 1, expectedProfileVersion: 0, profile } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.setWorkerAvatar({ providerId: "provider-1", workerId: "worker-1", expectedProfileVersion: 0, mediaFileId: null } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerLoginAccess.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.setWorkerAccessStatus({ providerId: "provider-1", workerId: "worker-1", expectedAccessVersion: 0, status: "REVOKED", transitionedAt: at } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerMember.findUnique.mockResolvedValueOnce({ level: "ADMIN" } as never);
    await expect(repository.setProviderAdminMembership({ providerId: "provider-1", userId: "user-1", actorUserId: "owner-1", active: true, expectedMembershipVersion: null, changedAt: at } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerMember.findUnique.mockResolvedValueOnce({ level: "ADMIN", version: 1 } as never);
    db.providerMember.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.setProviderAdminMembership({ providerId: "provider-1", userId: "user-1", actorUserId: "owner-1", active: true, expectedMembershipVersion: 0, changedAt: at } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    const issue = { providerId: "provider-1", workerId: "worker-1", expectedWorkerVersion: 1, expectedAccessVersion: null, invitationId: "invitation-1", invitationVersion: 1, emailNormalized: "worker@example.invalid", locale: "EN", actorUserId: "owner-1", issuedAt: at, expiresAt: invitationRow.expiresAt };
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorker.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.issueInvitation(issue as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerLoginAccess.findUnique.mockResolvedValueOnce(accessRow as never);
    await expect(repository.issueInvitation(issue as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    expect(db.providerWorkerInvitation.updateMany).not.toHaveBeenCalled();
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerLoginAccess.findUnique.mockResolvedValueOnce({ ...accessRow, version: 2 } as never);
    await expect(repository.issueInvitation({ ...issue, expectedAccessVersion: 1 } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerLoginAccess.findUnique.mockResolvedValueOnce(accessRow as never);
    db.providerWorkerLoginAccess.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.issueInvitation({ ...issue, expectedAccessVersion: 1 } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });

  it("rejects stale acceptance and Team/membership writes independently", async () => {
    const acceptance = { providerId: "provider-1", workerId: "worker-1", invitationId: "invitation-1", expectedInvitationVersion: 1, expectedWorkerVersion: 1, expectedAccessVersion: 1, identityUserId: "user-1", predecessorWorkerId: null, acceptedLocale: "EN", operationalPhoneE164: "+201000000001", acceptedAt: at };
    let db = makeDb();
    let repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerInvitation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.acceptInvitation({ ...acceptance, expectedInvitationVersion: 0 } as never)).rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorker.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.acceptInvitation({ ...acceptance, expectedWorkerVersion: 0 } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.acceptInvitation(acceptance as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerWorkerLoginAccess.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.acceptInvitation(acceptance as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerTeam.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.updateTeam({ providerId: "provider-1", teamId: "team-1", expectedVersion: 0 } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerTeam.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.addMembership({ providerId: "provider-1", teamId: "team-1", expectedVersion: 0, membershipId: "membership-1", workerId: "worker-1", cleans: true } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerTeam.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.updateMembership({ providerId: "provider-1", teamId: "team-1", membershipId: "membership-1", expectedTeamVersion: 0, expectedMembershipVersion: 1 } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    db = makeDb(); repository = new PrismaProviderWorkforceRepository(db as never);
    db.providerTeamMembership.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.updateMembership({ providerId: "provider-1", teamId: "team-1", membershipId: "membership-1", expectedMembershipVersion: 0 } as never)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });
});
