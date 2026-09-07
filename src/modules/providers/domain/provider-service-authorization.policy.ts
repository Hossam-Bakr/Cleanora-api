/**
 * Exact-scope authorization for Provider Service management (R1-P09).
 *
 * Active OWNER and ADMIN may manage offerings for their exact approved
 * Provider. Ownership transfer and membership administration remain outside
 * this surface and are never expanded here. Cross-Provider access fails closed
 * without enumeration.
 */

export type ProviderServiceManagementOperation =
  | "LIST_OFFERINGS"
  | "READ_OFFERING"
  | "CREATE_OFFERING"
  | "UPDATE_CONFIGURATION"
  | "PROPOSE_PRICE"
  | "ENABLE_OFFERING"
  | "DISABLE_OFFERING"
  | "READ_PRICE_HISTORY"
  | "READ_STATUS_HISTORY";

/**
 * Facts must come only from trusted identity, membership, and Provider rows.
 * Caller-supplied membership, actor ids, or Provider scope claims must never
 * be copied into this structure.
 */
export interface ProviderServiceAuthorizationFacts {
  readonly actorActive: boolean;
  /** Global Authentication `provider_admin` capability is ENABLED. */
  readonly providerAdminEnabled: boolean;
  /** Target Provider application status is APPROVED. */
  readonly providerApproved: boolean;
  /** Path providerId matches the membership/provider row under evaluation. */
  readonly sameProvider: boolean;
  readonly membershipActive: boolean;
  readonly managementLevel: "OWNER" | "ADMIN" | null;
}

export type ProviderServiceAuthorizationDenialCode =
  | "PROVIDER_SERVICE_FORBIDDEN"
  | "PROVIDER_SERVICE_NOT_FOUND"
  | "PROVIDER_SERVICE_PROVIDER_STATE_INVALID";

export type ProviderServiceAuthorizationDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly denialCode: ProviderServiceAuthorizationDenialCode;
    };

/**
 * @desc Decide whether an exact Provider OWNER/ADMIN may perform management.
 * @access Domain policy
 * @explanation Fail closed on cross-Provider and missing capability; never
 * grant ownership-transfer or membership-admin through this matrix.
 */
export function decideProviderServiceManagementAuthorization(
  _operation: ProviderServiceManagementOperation,
  facts: ProviderServiceAuthorizationFacts,
): ProviderServiceAuthorizationDecision {
  if (!facts.sameProvider) {
    return { allowed: false, denialCode: "PROVIDER_SERVICE_NOT_FOUND" };
  }

  if (!facts.actorActive || !facts.providerAdminEnabled) {
    return { allowed: false, denialCode: "PROVIDER_SERVICE_FORBIDDEN" };
  }

  if (!facts.providerApproved) {
    return {
      allowed: false,
      denialCode: "PROVIDER_SERVICE_PROVIDER_STATE_INVALID",
    };
  }

  if (
    !facts.membershipActive ||
    (facts.managementLevel !== "OWNER" && facts.managementLevel !== "ADMIN")
  ) {
    // Same path Provider without exact active OWNER/ADMIN: non-enumerating deny.
    return { allowed: false, denialCode: "PROVIDER_SERVICE_NOT_FOUND" };
  }

  return { allowed: true };
}

/** True only for exact active OWNER or ADMIN on an approved Provider. */
export function isExactProviderServiceManager(
  facts: ProviderServiceAuthorizationFacts,
): boolean {
  return decideProviderServiceManagementAuthorization("READ_OFFERING", facts)
    .allowed;
}

/**
 * Ownership transfer and membership administration stay on existing OWNER-only
 * Provider surfaces. This helper documents the hard exclusion for R1-P09.
 */
export function isProviderServiceOwnershipOrMembershipOperation(
  operation: string,
): boolean {
  return (
    operation === "TRANSFER_OWNERSHIP" ||
    operation === "MANAGE_MEMBERSHIP" ||
    operation === "MANAGE_INVITATIONS"
  );
}
