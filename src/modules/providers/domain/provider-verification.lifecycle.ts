import type {
  PayoutDestinationStatus,
  ProviderDocumentStatus,
} from "./provider-verification.types.js";

const DOCUMENT_TRANSITIONS: Readonly<Record<ProviderDocumentStatus, readonly ProviderDocumentStatus[]>> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED", "REPLACEMENT_REQUESTED"],
  APPROVED: ["EXPIRED", "INVALIDATED", "REPLACEMENT_REQUESTED", "SUPERSEDED"],
  REJECTED: [],
  REPLACEMENT_REQUESTED: [],
  EXPIRED: [],
  INVALIDATED: [],
  SUPERSEDED: [],
};

const PAYOUT_TRANSITIONS: Readonly<Record<PayoutDestinationStatus, readonly PayoutDestinationStatus[]>> = {
  DRAFT: ["PENDING_VERIFICATION", "REMOVED"],
  PENDING_VERIFICATION: ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "REMOVED"],
  APPROVED: ["REPLACEMENT_REQUESTED", "INVALIDATED", "SUPERSEDED", "REMOVED"],
  CHANGES_REQUESTED: ["SUPERSEDED", "REMOVED"],
  REPLACEMENT_REQUESTED: ["SUPERSEDED", "REMOVED"],
  REJECTED: [],
  INVALIDATED: [],
  SUPERSEDED: [],
  REMOVED: [],
};

export function isDocumentTransitionAllowed(
  from: ProviderDocumentStatus,
  to: ProviderDocumentStatus,
): boolean {
  return DOCUMENT_TRANSITIONS[from].includes(to);
}

export function assertDocumentTransition(
  from: ProviderDocumentStatus,
  to: ProviderDocumentStatus,
): void {
  if (!isDocumentTransitionAllowed(from, to)) throw new Error("DOCUMENT_STATE_CONFLICT");
}

export function isPayoutTransitionAllowed(
  from: PayoutDestinationStatus,
  to: PayoutDestinationStatus,
): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to);
}

export function assertPayoutTransition(
  from: PayoutDestinationStatus,
  to: PayoutDestinationStatus,
): void {
  if (!isPayoutTransitionAllowed(from, to)) {
    throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
  }
}

export function documentTransitionTargets(from: ProviderDocumentStatus): readonly ProviderDocumentStatus[] {
  return DOCUMENT_TRANSITIONS[from];
}

export function payoutTransitionTargets(from: PayoutDestinationStatus): readonly PayoutDestinationStatus[] {
  return PAYOUT_TRANSITIONS[from];
}
