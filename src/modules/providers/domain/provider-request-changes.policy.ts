import { providersError } from "./providers.errors.js";
import { assertApplicationTransition } from "./provider-lifecycle.policy.js";
import type { ProviderApplicationStatus } from "./providers.types.js";

const MAX_REASON_LENGTH = 2000;

/**
 * Trim and validate a Staff decision reason (FR-021).
 * Empty / whitespace-only reasons are rejected without state change.
 */
export function normalizeStaffDecisionReason(reason: string): string {
  return reason.trim();
}

export function assertRequestChangesReason(reason: string): string {
  const normalized = normalizeStaffDecisionReason(reason);
  if (normalized.length === 0 || normalized.length > MAX_REASON_LENGTH) {
    throw providersError("PROVIDER_REASON_REQUIRED");
  }
  return normalized;
}

export function assertRequestChangesTransition(
  from: ProviderApplicationStatus,
  to: ProviderApplicationStatus,
): void {
  if (to !== "CHANGES_REQUESTED") {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      domain: "APPLICATION",
      reason: "REQUEST_CHANGES_TARGET_INVALID",
      from,
      to,
    });
  }
  assertApplicationTransition(from, to);
}
