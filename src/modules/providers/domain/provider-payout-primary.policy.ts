import type { PayoutDestinationStatus } from "./provider-verification.types.js";

export function isPayoutVersionPrimaryEligible(input: {
  readonly status: PayoutDestinationStatus;
  readonly isCurrentVersion: boolean;
  readonly isEffectiveApprovedVersion: boolean;
}): boolean {
  // A voluntary successor becomes the management-current version while its
  // unchallenged approved predecessor deliberately remains the effective
  // primary until Staff approves the successor.
  return input.status === "APPROVED" && input.isEffectiveApprovedVersion;
}

export function derivePayoutDestinationReady(input: {
  readonly primaryDestinationVersionId: string | null;
  readonly currentApprovedDestinationVersionIds: readonly string[];
}): boolean {
  return input.primaryDestinationVersionId !== null &&
    input.currentApprovedDestinationVersionIds.includes(input.primaryDestinationVersionId);
}

export function shouldInitializeFirstPrimary(input: {
  readonly primaryDestinationVersionId: string | null;
  readonly predecessorVersionId: string | null;
  readonly primaryStateVersion: number;
}): boolean {
  return input.primaryDestinationVersionId === null &&
    input.predecessorVersionId === null &&
    input.primaryStateVersion === 0;
}

export function assertPrimaryRemoval(input: {
  readonly isPrimary: boolean;
  readonly otherApprovedDestinationIds: readonly string[];
  readonly replacementPrimaryDestinationVersionId: string | null;
  readonly acknowledgeReadinessLoss: boolean;
}): void {
  if (!input.isPrimary) return;
  if (input.otherApprovedDestinationIds.length > 0) {
    if (input.replacementPrimaryDestinationVersionId === null ||
      !input.otherApprovedDestinationIds.includes(input.replacementPrimaryDestinationVersionId)) {
      throw new Error("PAYOUT_PRIMARY_CONFLICT");
    }
    return;
  }
  if (!input.acknowledgeReadinessLoss || input.replacementPrimaryDestinationVersionId !== null) {
    throw new Error("PAYOUT_PRIMARY_CONFLICT");
  }
}

export function shouldRestoreFormerPrimary(input: {
  readonly formerPrimaryEligible: boolean;
  readonly primaryStateVersionAtChallenge: number | null;
  readonly currentPrimaryStateVersion: number;
}): boolean {
  return input.formerPrimaryEligible &&
    input.primaryStateVersionAtChallenge !== null &&
    input.primaryStateVersionAtChallenge === input.currentPrimaryStateVersion;
}
