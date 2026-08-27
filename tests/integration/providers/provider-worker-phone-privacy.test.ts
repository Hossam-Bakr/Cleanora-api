
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import type { WorkerAvatarPort } from "../../../src/modules/media/media.public.js";
import { ProviderWorkforceQueryService } from "../../../src/modules/providers/provider-workforce-query.service.js";

function worker(input: { readonly id: string; readonly identityUserId: string; readonly supervisorCapable?: boolean; readonly avatarMediaFileId?: string | null }): WorkerSnapshot {
  return {
    id: input.id,
    providerId: "provider-1",
    identityUserId: input.identityUserId,
    predecessorWorkerId: null,
    status: "ACTIVE",
    version: 2,
    acceptedInvitationLocale: "EN",
    endedAt: null,
    profile: {
      fullLegalName: input.id,
      gender: "MALE",
      operationalPhoneE164: input.id === "worker-target" ? "+201011111111" : "+201022222222",
      workerType: "CLEANING_STAFF",
      displayTitle: null,
      supervisorCapable: input.supervisorCapable ?? false,
      skills: ["private-skill"],
      avatarMediaFileId: input.avatarMediaFileId ?? null,
      version: 1,
    },
    access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
  };
}

const target = worker({ id: "worker-target", identityUserId: "target-user", avatarMediaFileId: "media-avatar-1" });
const supervisor = worker({ id: "worker-supervisor", identityUserId: "supervisor-user", supervisorCapable: true });
const team: TeamSnapshot = { id: "team-1", providerId: "provider-1", name: "Team", normalizedName: "team", status: "ACTIVE", primarySupervisorWorkerId: supervisor.id, version: 3 };
const members: readonly TeamMemberSnapshot[] = [
  { id: "membership-supervisor", teamId: team.id, workerId: supervisor.id, cleans: true, version: 1, endedAt: null, worker: supervisor },
  { id: "membership-target", teamId: team.id, workerId: target.id, cleans: true, version: 1, endedAt: null, worker: target },
];

function createQuery(options: { readonly actorUserId: string; readonly supervisorActive?: boolean }) {
  const memberships = options.actorUserId === "owner-1"
    ? { level: "OWNER" as const, active: true, version: 1 }
    : options.actorUserId === "admin-1"
      ? { level: "ADMIN" as const, active: true, version: 1 }
      : null;
  const context = {
    workforce: {
      readActorMembership: vi.fn(async () => memberships),
      getCurrentWorkerByIdentity: vi.fn(async (identityUserId: string) => {
        if (identityUserId === supervisor.identityUserId) return supervisor;
        if (identityUserId === target.identityUserId) return target;
        return null;
      }),
      getCurrentMembershipForWorker: vi.fn(async (workerId: string) => members.find((member) => member.workerId === workerId) ?? null),
      getTeam: vi.fn(async () => options.supervisorActive === false ? { ...team, primarySupervisorWorkerId: null } : team),
      getWorker: vi.fn(async (providerId: string, workerId: string) => providerId === target.providerId && workerId === target.id ? target : null),
      listWorkers: vi.fn(async () => [target, supervisor]),
      listCurrentTeamMembers: vi.fn(async () => members),
    },
    history: {
      listForWorker: vi.fn(async () => [{
        id: "history-1",
        providerId: target.providerId,
        targetType: "WORKER" as const,
        targetId: target.id,
        targetVersion: 2,
        eventCode: "WORKER_ACTIVATED",
        actorUserId: "owner-1",
        safeBefore: { status: "DRAFT", version: 1 },
        safeAfter: { status: "ACTIVE", version: 2 },
        requestId: "request-1",
        createdAt: new Date("2026-08-23T10:00:00.000Z"),
      }]),
    },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  const avatar: WorkerAvatarPort = {
    ingest: vi.fn(),
    readValidationReceipt: vi.fn(),
    issuePrivateDelivery: vi.fn(async () => ({
      url: "https://private.example.invalid/signed-avatar",
      expiresAt: new Date("2026-08-23T10:05:00.000Z"),
    })),
    requestCleanup: vi.fn(),
  };
  return { service: new ProviderWorkforceQueryService(unitOfWork, avatar), context, avatar };
}

describe("Worker operational-phone privacy and scoped projections", () => {
  it("keeps all Provider/Supervisor list projections phone-free", async () => {
    for (const actorUserId of ["owner-1", "admin-1", "supervisor-user"]) {
      const result = await createQuery({ actorUserId }).service.listWorkers({ actorUserId, providerId: "provider-1" });
      expect(result.items.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toMatch(/operationalPhone|\+2010/iu);
    }
  });

  it("returns full phone only to management, exact self, and the live current-Team primary Supervisor", async () => {
    const ownerHarness = createQuery({ actorUserId: "owner-1" });
    const owner = await ownerHarness.service.getWorker({ actorUserId: "owner-1", providerId: "provider-1", workerId: target.id });
    expect(owner).toMatchObject({
      viewScope: "PROVIDER_MANAGEMENT",
      operationalPhoneE164: "+201011111111",
      avatar: { url: "https://private.example.invalid/signed-avatar", expiresAt: "2026-08-23T10:05:00.000Z" },
    });
    expect(ownerHarness.avatar.issuePrivateDelivery).toHaveBeenCalledWith({
      mediaFileId: "media-avatar-1",
      actorUserId: "owner-1",
      providerId: "provider-1",
      workerId: target.id,
      purpose: "WORKER_AVATAR_PRIVATE_READ",
    });
    const selfHarness = createQuery({ actorUserId: "target-user" });
    const self = await selfHarness.service.getWorker({ actorUserId: "target-user", providerId: "provider-1", workerId: target.id });
    expect(self).toMatchObject({ viewScope: "SELF", operationalPhoneE164: "+201011111111", avatar: { url: "https://private.example.invalid/signed-avatar" } });
    const scopedHarness = createQuery({ actorUserId: "supervisor-user" });
    const scoped = await scopedHarness.service.getWorker({ actorUserId: "supervisor-user", providerId: "provider-1", workerId: target.id });
    expect(scoped).toEqual(expect.objectContaining({ viewScope: "PRIMARY_SUPERVISOR", teamId: team.id, operationalPhoneE164: "+201011111111" }));
    expect(scoped).not.toHaveProperty("skills");
    expect(scoped).not.toHaveProperty("loginAccessStatus");
    expect(scoped).not.toHaveProperty("avatar");
    expect(scopedHarness.avatar.issuePrivateDelivery).not.toHaveBeenCalled();
  });

  it("removes phone/profile scope immediately after Supervisor assignment loss and does not enumerate cross-Provider targets", async () => {
    const lostScope = createQuery({ actorUserId: "supervisor-user", supervisorActive: false });
    await expect(lostScope.service.getWorker({
      actorUserId: "supervisor-user", providerId: "provider-1", workerId: target.id,
    })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
    expect(lostScope.avatar.issuePrivateDelivery).not.toHaveBeenCalled();
    await expect(createQuery({ actorUserId: "customer-1" }).service.getWorker({
      actorUserId: "customer-1", providerId: "provider-1", workerId: target.id,
    })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
    await expect(createQuery({ actorUserId: "owner-1" }).service.getWorker({
      actorUserId: "owner-1", providerId: "other-provider", workerId: target.id,
    })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
  });

  it("returns safe management-only Worker history without phone or access secrets", async () => {
    const result = await createQuery({ actorUserId: "owner-1" }).service.listWorkerHistory({
      actorUserId: "owner-1", providerId: "provider-1", workerId: target.id,
    });
    expect(result.items).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/(?:operationalPhone|\+2010|proof|password|credential|token)/iu);
    await expect(createQuery({ actorUserId: "supervisor-user" }).service.listWorkerHistory({
      actorUserId: "supervisor-user", providerId: "provider-1", workerId: target.id,
    })).rejects.toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
  });
});
