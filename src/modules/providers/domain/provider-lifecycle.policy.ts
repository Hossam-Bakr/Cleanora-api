import { providersError } from "./providers.errors.js";
import type {
  ExpectedVersion,
  ProviderApplicationStatus,
  ProviderOperationalStatus,
} from "./providers.types.js";

const APPLICATION_TRANSITIONS: Readonly<
  Record<ProviderApplicationStatus, readonly ProviderApplicationStatus[]>
> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "REJECTED"],
  CHANGES_REQUESTED: ["PENDING_REVIEW"],
  APPROVED: [],
  REJECTED: [],
};

const OPERATIONAL_TRANSITIONS: Readonly<
  Record<ProviderOperationalStatus, readonly ProviderOperationalStatus[]>
> = {
  INACTIVE: ["SUSPENDED"],
  SUSPENDED: ["INACTIVE"],
  LIVE: [],
};

const MAX_REASON_LENGTH = 2000;

/**
 * Trim and validate Staff suspension/reinstatement reasons (FR-021, FR-030).
 */
export function assertOperationalDecisionReason(reason: string): string {
  const normalized = reason.trim();
  if (normalized.length === 0 || normalized.length > MAX_REASON_LENGTH) {
    throw providersError("PROVIDER_REASON_REQUIRED");
  }
  return normalized;
}

/**
 * Operational suspend/reinstate apply only after approval (FR-030).
 */
export function assertApprovedForOperationalLifecycle(
  applicationStatus: ProviderApplicationStatus,
): void {
  if (applicationStatus === "APPROVED") {
    return;
  }
  throw providersError("PROVIDER_STATE_CONFLICT", {
    domain: "OPERATIONAL",
    reason: "APPLICATION_NOT_APPROVED",
    applicationStatus,
  });
}

export function assertExpectedVersion(value: ExpectedVersion): void {
  if (!Number.isInteger(value) || value < 1) {
    throw providersError("VALIDATION_ERROR", {
      field: "expectedVersion",
    });
  }
}

export function canTransitionApplication(
  from: ProviderApplicationStatus,
  to: ProviderApplicationStatus,
): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

export function assertApplicationTransition(
  from: ProviderApplicationStatus,
  to: ProviderApplicationStatus,
): void {
  if (canTransitionApplication(from, to)) {
    return;
  }
  throw providersError("PROVIDER_STATE_CONFLICT", {
    domain: "APPLICATION",
    from,
    to,
  });
}

export function canTransitionOperational(
  from: ProviderOperationalStatus,
  to: ProviderOperationalStatus,
): boolean {
  return OPERATIONAL_TRANSITIONS[from].includes(to);
}

export function assertOperationalTransition(
  from: ProviderOperationalStatus,
  to: ProviderOperationalStatus,
): void {
  if (to === "LIVE") {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      domain: "OPERATIONAL",
      reason: "LIVE_COMMAND_UNSUPPORTED",
      from,
      to,
    });
  }
  if (canTransitionOperational(from, to)) {
    return;
  }
  throw providersError("PROVIDER_STATE_CONFLICT", {
    domain: "OPERATIONAL",
    from,
    to,
  });
}

/** R1-P05 never restores LIVE; reinstatement always targets INACTIVE. */
export function reinstateOperationalTarget(): "INACTIVE" {
  return "INACTIVE";
}

/**
 * Rejected applications are terminal. Restart / reopen is out of scope.
 */
export function assertRejectedRestartDenied(
  status: ProviderApplicationStatus,
): void {
  if (status !== "REJECTED") {
    return;
  }
  throw providersError("PROVIDER_STATE_CONFLICT", {
    domain: "APPLICATION",
    reason: "REJECTED_RESTART_DENIED",
  });
}

export function isTerminalApplicationStatus(
  status: ProviderApplicationStatus,
): boolean {
  return status === "APPROVED" || status === "REJECTED";
}
