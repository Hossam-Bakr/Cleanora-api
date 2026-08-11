import { providersError } from "./providers.errors.js";
import {
  assertApplicationTransition,
  assertRejectedRestartDenied,
} from "./provider-lifecycle.policy.js";
import type { ProviderApplicationStatus } from "./providers.types.js";
import {
  assertRequestChangesReason,
  normalizeStaffDecisionReason,
} from "./provider-request-changes.policy.js";

export function assertRejectionReason(reason: string): string {
  return assertRequestChangesReason(reason);
}

export { normalizeStaffDecisionReason };

export function assertRejectionTransition(
  from: ProviderApplicationStatus,
  to: ProviderApplicationStatus,
): void {
  if (to !== "REJECTED") {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      domain: "APPLICATION",
      reason: "REJECTION_TARGET_INVALID",
      from,
      to,
    });
  }
  assertApplicationTransition(from, to);
}

/**
 * After rejection, no membership / invitation / owner category / provider_admin
 * may exist as a side effect of the rejection transaction (FR-060).
 */
export function assertRejectionLeavesNoAuthorityEffects(facts: {
  readonly memberCount: number;
  readonly invitationCount: number;
  readonly hasProviderOwnerCategory: boolean;
  readonly providerAdminEnabled: boolean;
}): void {
  if (
    facts.memberCount !== 0 ||
    facts.invitationCount !== 0 ||
    facts.hasProviderOwnerCategory ||
    facts.providerAdminEnabled
  ) {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      domain: "APPLICATION",
      reason: "REJECTION_MUST_NOT_CREATE_AUTHORITY",
    });
  }
}

export function assertRejectedApplicationLocked(
  status: ProviderApplicationStatus,
): void {
  assertRejectedRestartDenied(status);
}
