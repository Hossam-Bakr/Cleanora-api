import { providersError } from "./providers.errors.js";
import { calculateMarketplaceReadiness } from "./provider-readiness.policy.js";
import type {
  MarketplaceReadiness,
  ProviderKind,
  ProviderOperationalStatus,
} from "./providers.types.js";

export interface CompleteApprovalOutcomeFacts {
  readonly applicationStatus: string;
  readonly operationalStatus: ProviderOperationalStatus;
  readonly ownerUserId: string | null;
  readonly hasProviderOwnerCategory: boolean;
  readonly providerAdminEnabled: boolean;
  readonly hasActiveOwnerMembership: boolean;
  readonly hasApprovedHistoryForCycle: boolean;
  readonly hasApprovedOutboxIntent: boolean;
}

/** Approval must never set LIVE (FR-027–FR-029; SC-009). */
export function assertApprovalNeverSetsLive(
  operationalStatus: ProviderOperationalStatus,
): void {
  if (operationalStatus === "LIVE") {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      domain: "OPERATIONAL",
      reason: "APPROVAL_MUST_NOT_SET_LIVE",
    });
  }
}

/**
 * Successful approval leaves operational status INACTIVE.
 * Any other target is a contract violation.
 */
export function assertApprovalLeavesInactive(
  operationalStatus: ProviderOperationalStatus,
): "INACTIVE" {
  assertApprovalNeverSetsLive(operationalStatus);
  if (operationalStatus !== "INACTIVE") {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      domain: "OPERATIONAL",
      reason: "APPROVAL_MUST_LEAVE_INACTIVE",
      operationalStatus,
    });
  }
  return "INACTIVE";
}

/** Readiness after approval: applicationApproved true; LIVE/public false. */
export function evaluateApprovalReadinessAfterApprove(input: {
  readonly kind: ProviderKind;
  readonly profileCompletionPercentage: number;
}): MarketplaceReadiness {
  return calculateMarketplaceReadiness({
    kind: input.kind,
    applicationStatus: "APPROVED",
    operationalStatus: "INACTIVE",
    profileCompletionPercentage: input.profileCompletionPercentage,
  });
}

/**
 * Idempotent approval is allowed only when every ownership component matches.
 * Incomplete APPROVED state is an integrity failure, not a silent success.
 */
export function isCompleteApprovalOutcome(
  facts: CompleteApprovalOutcomeFacts,
): boolean {
  return (
    facts.applicationStatus === "APPROVED" &&
    facts.operationalStatus === "INACTIVE" &&
    facts.ownerUserId !== null &&
    facts.hasProviderOwnerCategory &&
    facts.providerAdminEnabled &&
    facts.hasActiveOwnerMembership &&
    facts.hasApprovedHistoryForCycle &&
    facts.hasApprovedOutboxIntent
  );
}

export function assertCompleteApprovalOutcomeOrIntegrity(
  facts: CompleteApprovalOutcomeFacts,
): void {
  if (isCompleteApprovalOutcome(facts)) {
    return;
  }
  throw providersError("PROVIDER_STATE_CONFLICT", {
    domain: "APPLICATION",
    reason: "APPROVAL_OUTCOME_INCOMPLETE",
  });
}
