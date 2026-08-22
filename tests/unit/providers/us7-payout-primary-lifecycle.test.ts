import {
  assertPrimaryRemoval,
  derivePayoutDestinationReady,
  isPayoutVersionPrimaryEligible,
  shouldInitializeFirstPrimary,
  shouldRestoreFormerPrimary,
} from "../../../src/modules/providers/domain/provider-payout-primary.policy.js";

describe("R1-P06 US7 primary lifecycle", () => {
  it("requires an effective approved primary and permits voluntary-successor continuity", () => {
    expect(isPayoutVersionPrimaryEligible({ status: "APPROVED", isCurrentVersion: false, isEffectiveApprovedVersion: true })).toBe(true);
    expect(isPayoutVersionPrimaryEligible({ status: "PENDING_VERIFICATION", isCurrentVersion: true, isEffectiveApprovedVersion: false })).toBe(false);
    expect(derivePayoutDestinationReady({ primaryDestinationVersionId: "approved", currentApprovedDestinationVersionIds: ["approved"] })).toBe(true);
    expect(derivePayoutDestinationReady({ primaryDestinationVersionId: "pending", currentApprovedDestinationVersionIds: [] })).toBe(false);
  });

  it("requires atomic replacement when another approval exists", () => {
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: ["other"], replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: true })).toThrow("PAYOUT_PRIMARY_CONFLICT");
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: ["other"], replacementPrimaryDestinationVersionId: "other", acknowledgeReadinessLoss: false })).not.toThrow();
  });

  it("requires explicit last-primary acknowledgement and exact restoration state", () => {
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: [], replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: false })).toThrow("PAYOUT_PRIMARY_CONFLICT");
    expect(() => assertPrimaryRemoval({ isPrimary: true, otherApprovedDestinationIds: [], replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: true })).not.toThrow();
    expect(shouldRestoreFormerPrimary({ formerPrimaryEligible: true, primaryStateVersionAtChallenge: 4, currentPrimaryStateVersion: 4 })).toBe(true);
    expect(shouldRestoreFormerPrimary({ formerPrimaryEligible: true, primaryStateVersionAtChallenge: 4, currentPrimaryStateVersion: 5 })).toBe(false);
  });

  it("initializes only the Provider's true first primary", () => {
    expect(shouldInitializeFirstPrimary({
      primaryDestinationVersionId: null,
      predecessorVersionId: null,
      primaryStateVersion: 0,
    })).toBe(true);
    expect(shouldInitializeFirstPrimary({
      primaryDestinationVersionId: null,
      predecessorVersionId: null,
      primaryStateVersion: 2,
    })).toBe(false);
    expect(shouldInitializeFirstPrimary({
      primaryDestinationVersionId: "approved-v1",
      predecessorVersionId: null,
      primaryStateVersion: 1,
    })).toBe(false);
    expect(shouldInitializeFirstPrimary({
      primaryDestinationVersionId: null,
      predecessorVersionId: "challenged-v1",
      primaryStateVersion: 1,
    })).toBe(false);
  });
});
