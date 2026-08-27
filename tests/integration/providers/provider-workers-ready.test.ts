
import type { ProvidersWorkforceTransactionContext, ProvidersWorkforceUnitOfWorkPort, WorkerSnapshot } from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { ProviderWorkforceReadinessService } from "../../../src/modules/providers/provider-workforce-readiness.service.js";

function candidate(overrides: Partial<WorkerSnapshot> = {}): WorkerSnapshot {
  return {
    id: "worker-1", providerId: "provider-1", identityUserId: "user-1", predecessorWorkerId: null,
    status: "ACTIVE", version: 1, acceptedInvitationLocale: "AR", endedAt: null,
    profile: { fullLegalName: "Ready Worker", gender: "FEMALE", operationalPhoneE164: "+201011111111", workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false, skills: [], avatarMediaFileId: null, version: 1 },
    access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
    ...overrides,
  };
}

function createService(workers: readonly WorkerSnapshot[], identities: Readonly<Record<string, { readonly active: boolean; readonly role: boolean }>> = { "user-1": { active: true, role: true } }) {
  const run = vi.fn(async <T>(callback: (context: ProvidersWorkforceTransactionContext) => Promise<T>) => callback(context));
  const context = {
    workforce: {
      lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
      readActorMembership: vi.fn(async () => ({ level: "OWNER" as const, active: true, version: 1 })),
      listReadinessCandidates: async () => workers,
      getTeam: async () => null,
    },
    identityReader: {
      getIdentity: async (userId: string) => {
        const value = identities[userId];
        return value === undefined ? null : { userId, status: value.active ? "ACTIVE" as const : "SUSPENDED" as const, isAccountActive: value.active, emailNormalized: null, workerRoleEnabled: value.role, providerSupervisorRoleEnabled: false, preferredLanguage: null };
      },
    },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork = { run } as unknown as ProvidersWorkforceUnitOfWorkPort;
  return { service: new ProviderWorkforceReadinessService(unitOfWork), context, run };
}

describe("derived Provider workersReady", () => {
  it("counts only complete active cleaning staff with active identity, Worker role, and access", async () => {
    const result = await createService([
      candidate(),
      candidate({ id: "escort", profile: { ...candidate().profile, workerType: "ESCORT" } }),
      candidate({ id: "inactive", status: "INACTIVE" }),
      candidate({ id: "no-access", access: { status: "REVOKED", version: 2, currentInvitationId: "invitation-2" } }),
    ]).service.getWorkersReady("provider-1");
    expect(result).toEqual({ providerId: "provider-1", workersReady: true, qualifyingWorkerCount: 1, blockerCodes: [] });
  });

  it.each([
    [[candidate({ status: "INACTIVE" })], "NO_ACTIVE_CLEANING_WORKER", undefined],
    [[candidate({ profile: { ...candidate().profile, fullLegalName: "" } })], "PROFILE_INCOMPLETE", undefined],
    [[candidate()], "WORKER_ACCOUNT_OR_ROLE_INACTIVE", { "user-1": { active: true, role: false } }],
    [[candidate({ access: { status: "REVOKED", version: 2, currentInvitationId: null } })], "WORKER_LOGIN_ACCESS_INACTIVE", undefined],
  ] as const)("derives blocker %s without persisting a readiness flag", async (workers, blocker, identities) => {
    const result = await createService(workers, identities).service.getWorkersReady("provider-1");
    expect(result?.workersReady).toBe(false);
    expect(result?.qualifyingWorkerCount).toBe(0);
    expect(result?.blockerCodes).toContain(blocker);
  });

  it("returns null for an unknown Provider", async () => {
    const context = { workforce: { lockProvider: async () => null } } as unknown as ProvidersWorkforceTransactionContext;
    const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
    await expect(new ProviderWorkforceReadinessService(unitOfWork).getWorkersReady("missing")).resolves.toBeNull();
  });

  it("authorizes and derives actor readiness in one Provider-locked transaction", async () => {
    const harness = createService([candidate()]);
    await expect(harness.service.getForActor({ actorUserId: "owner-1", providerId: "provider-1" }))
      .resolves.toMatchObject({ workforceVersion: 1, workersReady: true, qualifyingWorkerCount: 1 });
    expect(harness.run).toHaveBeenCalledTimes(1);
    const lockProvider = harness.context.workforce.lockProvider as ReturnType<typeof vi.fn>;
    const readActorMembership = harness.context.workforce.readActorMembership as ReturnType<typeof vi.fn>;
    expect(lockProvider.mock.invocationCallOrder[0]).toBeLessThan(readActorMembership.mock.invocationCallOrder[0]!);
  });
});
