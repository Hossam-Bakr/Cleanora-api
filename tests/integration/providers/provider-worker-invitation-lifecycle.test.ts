
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";
import { HmacWorkerInvitationProofAdapter } from "../../../src/modules/providers/infrastructure/worker-invitation-proof.adapter.js";
import { ProviderWorkforceInvitationQueryService } from "../../../src/modules/providers/provider-workforce-invitation-query.service.js";

const issuedAt = new Date("2026-08-22T12:00:00.000Z");
const expiresAt = new Date(issuedAt.getTime() + 72 * 60 * 60 * 1000);
const invitation: WorkerInvitationSnapshot = {
  id: "invitation-2", workerId: "worker-1", invitationVersion: 2,
  emailNormalized: "worker@example.invalid", locale: "EN", status: "PENDING", version: 4,
  issuedByUserId: "owner-1", acceptedByUserId: null, issuedAt, expiresAt,
  acceptedAt: null, revokedAt: null, expiredAt: null, supersededAt: null,
};
const worker: WorkerSnapshot = {
  id: "worker-1", providerId: "provider-1", identityUserId: null, predecessorWorkerId: null,
  status: "DRAFT", version: 5, acceptedInvitationLocale: null, endedAt: null,
  profile: {
    fullLegalName: "Synthetic Worker", gender: "FEMALE", operationalPhoneE164: "+201012345678",
    workerType: "CLEANING_STAFF", displayTitle: null, supervisorCapable: false, skills: [],
    avatarMediaFileId: null, version: 1,
  },
  access: { status: "INVITED", version: 3, currentInvitationId: invitation.id },
};

function createHarness(options: { readonly now?: Date; readonly latest?: WorkerInvitationSnapshot } = {}) {
  const proof = new HmacWorkerInvitationProofAdapter("r1-p07-synthetic-auth-verifier-secret-32-bytes-minimum");
  const transitionInvitation = vi.fn(async () => ({
    worker: { ...worker, access: { status: "EXPIRED" as const, version: 4, currentInvitationId: invitation.id } },
    invitation: { ...invitation, status: "EXPIRED" as const, version: 5, expiredAt: options.now ?? expiresAt },
  }));
  const context = {
    workforce: {
      getWorkerForInvitation: vi.fn(async () => worker),
      getInvitation: vi.fn(async () => invitation),
      getLatestInvitation: vi.fn(async () => options.latest ?? invitation),
      lockProvider: vi.fn(async () => ({ id: worker.providerId, workforceStateVersion: 1 })),
      lockWorker: vi.fn(async () => worker),
      transitionInvitation,
    },
  } as unknown as ProvidersWorkforceTransactionContext;
  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = { run: async (callback) => callback(context) };
  const service = new ProviderWorkforceInvitationQueryService({
    unitOfWork,
    invitationProof: proof,
    now: () => options.now ?? new Date(issuedAt.getTime() + 60_000),
  });
  const invitationProof = proof.issue({
    invitationId: invitation.id,
    invitationVersion: invitation.invitationVersion,
    emailNormalized: invitation.emailNormalized,
    locale: invitation.locale,
    expiresAt: invitation.expiresAt,
  });
  return { service, invitationProof, transitionInvitation };
}

describe("Worker invitation latest-proof inspection and expiry", () => {
  it("returns only the safe latest-version projection with a masked email", async () => {
    const harness = createHarness();
    const result = await harness.service.inspect({ invitationProof: harness.invitationProof });
    expect(result).toEqual({
      providerId: "provider-1",
      workerId: "worker-1",
      invitationVersion: 2,
      expectedVersion: 4,
      locale: "EN",
      maskedEmail: "w***@example.invalid",
      expiresAt,
      onboardingMode: "AUTHENTICATE_OR_CREATE",
      expectedWorkerVersion: 5,
      expectedAccessVersion: 3,
    });
    expect(JSON.stringify(result)).not.toContain("worker@example.invalid");
  });

  it("materializes due PENDING access as EXPIRED, then returns one generic invalid error", async () => {
    const now = new Date(expiresAt.getTime() + 1);
    const harness = createHarness({ now });
    await expect(harness.service.inspect({ invitationProof: harness.invitationProof }))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    expect(harness.transitionInvitation).toHaveBeenCalledWith(expect.objectContaining({
      invitationId: invitation.id,
      expectedInvitationVersion: 4,
      expectedAccessVersion: 3,
      status: "EXPIRED",
    }));
  });

  it("rejects a superseded or tampered proof without exposing which check failed", async () => {
    const harness = createHarness({ latest: { ...invitation, id: "invitation-3", invitationVersion: 3 } });
    await expect(harness.service.inspect({ invitationProof: harness.invitationProof }))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    await expect(createHarness().service.inspect({ invitationProof: `${harness.invitationProof}x` }))
      .rejects.toMatchObject({ code: "WORKER_INVITATION_INVALID" });
    expect(harness.transitionInvitation).not.toHaveBeenCalled();
  });
});
