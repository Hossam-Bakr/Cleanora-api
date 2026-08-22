import { assertPrimaryRemoval, shouldRestoreFormerPrimary } from "../../../src/modules/providers/domain/provider-payout-primary.policy.js";
import { ProviderPayoutPrimaryService } from "../../../src/modules/providers/provider-payout-primary.service.js";
import { R1_P06_IDS } from "../../helpers/r1-p06-fixtures.js";

const now = new Date("2026-08-14T10:00:00.000Z");
const principal = {
  userId: R1_P06_IDS.ownerUserId,
  sessionId: R1_P06_IDS.sessionId,
  accountCategories: [],
  verifiedCategories: [],
  pendingCategories: [],
  status: "ACTIVE" as const,
  verificationOnly: false,
};

function primaryHarness() {
  const access = {
    applicationStatus: "APPROVED",
    ownerUserId: R1_P06_IDS.ownerUserId,
    members: [{ level: "OWNER", status: "ACTIVE" }],
  };
  const primaryState = {
    payoutPrimaryStateVersion: 6,
    primaryPayoutDestination: { destinationVersionId: R1_P06_IDS.destinationVersionId },
  };
  const current = {
    id: R1_P06_IDS.destinationVersionId,
    status: "APPROVED",
    version: 4,
    chain: { currentVersionId: R1_P06_IDS.destinationVersionId, effectiveApprovedVersionId: R1_P06_IDS.destinationVersionId },
  };
  const replacement = {
    id: "approved-replacement",
    status: "APPROVED",
    version: 2,
    chain: { currentVersionId: "approved-replacement", effectiveApprovedVersionId: "approved-replacement" },
  };
  const repository = {
    readAccess: vi.fn().mockResolvedValue(access),
    findPrimaryReplay: vi.fn().mockResolvedValue(null),
    setPrimary: vi.fn().mockResolvedValue({ destinationVersionId: R1_P06_IDS.destinationVersionId }),
    readPrimaryState: vi.fn().mockResolvedValue(primaryState),
    findPayoutRemovalReplay: vi.fn().mockResolvedValue(null),
    read: vi.fn().mockResolvedValue(current),
    list: vi.fn().mockResolvedValue([current, replacement]),
    remove: vi.fn().mockResolvedValue({ ...current, status: "REMOVED", version: 5 }),
  };
  const proofVerifier = { verify: vi.fn().mockResolvedValue({ proofId: "proof-primary-r1p06" }) };
  const service = new ProviderPayoutPrimaryService(repository as never, proofVerifier as never, () => now);
  return { service, repository, proofVerifier, access, primaryState, current, replacement };
}

describe("R1-P06 US7 competing primary commands", () => {
  it("rejects stale restoration after any competing primary mutation", () => {
    const snapshots = [7, 8, 9].map((currentPrimaryStateVersion) => shouldRestoreFormerPrimary({ formerPrimaryEligible: true, primaryStateVersionAtChallenge: 7, currentPrimaryStateVersion }));
    expect(snapshots).toEqual([true, false, false]);
  });

  it("never permits a primary removal to select an ineligible replacement", () => {
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: ["approved-a"], replacementPrimaryDestinationVersionId: "pending-b", acknowledgeReadinessLoss: true })).toThrow("PAYOUT_PRIMARY_CONFLICT");
  });

  it("allows matching retries to resolve to the same deterministic decision", () => {
    const command = { isPrimary: true, otherApprovedDestinationIds: [] as string[], replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: true };
    expect(() => assertPrimaryRemoval(command)).not.toThrow();
    expect(() => assertPrimaryRemoval(command)).not.toThrow();
  });

  it("sets an approved primary with recent authentication and both optimistic versions", async () => {
    const { service, repository, proofVerifier } = primaryHarness();
    await expect(service.setPrimary({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedDestinationVersion: 4,
      expectedPrimaryVersion: 5,
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-set-primary",
    })).resolves.toMatchObject({ primaryStateVersion: 6 });
    expect(proofVerifier.verify).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "PROVIDER_PAYOUT_PRIMARY_CHANGE",
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      maximumAgeSeconds: 600,
    }));
    expect(repository.setPrimary).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: R1_P06_IDS.ownerUserId,
      proofId: "proof-primary-r1p06",
      expectedDestinationVersion: 4,
      expectedPrimaryVersion: 5,
      now,
    }));
  });

  it("returns exact set-primary retries without consuming a second proof", async () => {
    const { service, repository, proofVerifier } = primaryHarness();
    repository.findPrimaryReplay.mockResolvedValueOnce({ destinationVersionId: R1_P06_IDS.destinationVersionId });
    await service.setPrimary({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedDestinationVersion: 4,
      expectedPrimaryVersion: 5,
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-set-primary-retry",
    });
    expect(proofVerifier.verify).not.toHaveBeenCalled();
    expect(repository.setPrimary).not.toHaveBeenCalled();
  });

  it("removes a primary only with an eligible atomic replacement and a meaningful note", async () => {
    const { service, repository, proofVerifier } = primaryHarness();
    await expect(service.remove({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 4,
      expectedPrimaryVersion: 6,
      replacementPrimaryDestinationVersionId: "approved-replacement",
      acknowledgeReadinessLoss: false,
      reason: "Provider replaced the approved payout destination",
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-remove-primary",
    })).resolves.toMatchObject({ primaryStateVersion: 6, destination: { status: "REMOVED" } });
    expect(proofVerifier.verify).toHaveBeenCalledWith(expect.objectContaining({ purpose: "PROVIDER_PAYOUT_REMOVE" }));
    expect(repository.remove).toHaveBeenCalledWith(expect.objectContaining({
      replacementPrimaryDestinationVersionId: "approved-replacement",
      proofId: "proof-primary-r1p06",
      now,
    }));
  });

  it("uses the withdrawal proof purpose for a pending destination and returns exact retries", async () => {
    const { service, repository, proofVerifier, current } = primaryHarness();
    repository.read.mockResolvedValueOnce({ ...current, status: "PENDING_VERIFICATION" });
    repository.readPrimaryState.mockResolvedValue({ payoutPrimaryStateVersion: 6, primaryPayoutDestination: null });
    repository.list.mockResolvedValueOnce([{ ...current, status: "PENDING_VERIFICATION" }]);
    await service.remove({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 4,
      expectedPrimaryVersion: 6,
      replacementPrimaryDestinationVersionId: null,
      acknowledgeReadinessLoss: false,
      reason: "Provider withdrew the pending payout destination",
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-withdraw-pending",
    });
    expect(proofVerifier.verify).toHaveBeenCalledWith(expect.objectContaining({ purpose: "PROVIDER_PAYOUT_WITHDRAW" }));

    repository.findPayoutRemovalReplay.mockResolvedValueOnce({ ...current, status: "REMOVED" });
    await service.remove({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 4,
      expectedPrimaryVersion: 6,
      replacementPrimaryDestinationVersionId: null,
      acknowledgeReadinessLoss: false,
      reason: "Provider withdrew the pending payout destination",
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-withdraw-pending",
    });
    expect(proofVerifier.verify).toHaveBeenCalledTimes(1);
    expect(repository.remove).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthorized, stale, and ambiguous last-primary commands without writes", async () => {
    const unauthorized = primaryHarness();
    unauthorized.repository.readAccess.mockResolvedValueOnce({ ...unauthorized.access, members: [{ level: "ADMIN", status: "ACTIVE" }] });
    await expect(unauthorized.service.setPrimary({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedDestinationVersion: 4,
      expectedPrimaryVersion: 5,
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-unauthorized-primary",
    })).rejects.toThrow("PROVIDER_SCOPE_DENIED");
    expect(unauthorized.repository.setPrimary).not.toHaveBeenCalled();

    const stale = primaryHarness();
    stale.repository.readPrimaryState.mockResolvedValueOnce({ ...stale.primaryState, payoutPrimaryStateVersion: 7 });
    await expect(stale.service.remove({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 4,
      expectedPrimaryVersion: 6,
      replacementPrimaryDestinationVersionId: "approved-replacement",
      acknowledgeReadinessLoss: false,
      reason: "Provider replaced the approved payout destination",
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-stale-remove",
    })).rejects.toThrow("PAYOUT_DESTINATION_VERSION_CONFLICT");
    expect(stale.repository.remove).not.toHaveBeenCalled();

    const lastPrimary = primaryHarness();
    lastPrimary.repository.list.mockResolvedValueOnce([lastPrimary.current]);
    await expect(lastPrimary.service.remove({
      principal,
      providerId: R1_P06_IDS.providerId,
      destinationVersionId: R1_P06_IDS.destinationVersionId,
      expectedVersion: 4,
      expectedPrimaryVersion: 6,
      replacementPrimaryDestinationVersionId: null,
      acknowledgeReadinessLoss: false,
      reason: "Provider removes the last approved payout destination",
      reauthenticationProof: "opaque-proof-at-least-16",
      commandId: R1_P06_IDS.commandId,
      requestId: "request-last-primary-remove",
    })).rejects.toThrow("PAYOUT_PRIMARY_CONFLICT");
    expect(lastPrimary.repository.remove).not.toHaveBeenCalled();
  });
});
