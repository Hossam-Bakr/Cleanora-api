/**
 * Pure Providers-owned availability/coverage domain policy (DEC-056, DEC-058).
 * No I/O; every fact arrives already resolved by the service/repository.
 */

import type { CoverageSelectionInput } from "./provider-availability.types.js";

/**
 * Facts must come only from trusted identity, membership, and Provider rows.
 * Caller-supplied membership, actor ids, or Provider scope claims must never
 * be copied into this structure.
 */
export interface ProviderAvailabilityManagementFacts {
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

export type ProviderAvailabilityAuthorizationDenialCode =
  | "PROVIDER_AVAILABILITY_POLICY_FORBIDDEN"
  | "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND"
  | "PROVIDER_AVAILABILITY_POLICY_PROVIDER_STATE_INVALID";

export type ProviderAvailabilityAuthorizationDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly denialCode: ProviderAvailabilityAuthorizationDenialCode;
    };

/**
 * @desc Decide whether an exact Provider OWNER/ADMIN may manage Phase 10
 * availability configuration (coverage, schedules, capacity, pause) for an
 * approved Provider in any operational state (DEC-058).
 * @explanation DEC-058 differs deliberately from R1-P09's Provider Service
 * management policy: an active, exact-scope OWNER is trusted without an
 * enabled `provider_admin` capability, because ownership itself is the
 * trusted signal. An active, exact-scope ADMIN still requires Authentication
 * to say `providerAdminEnabled`. Workers, Team Supervisors and any other
 * membership level gain no Phase 10 authority (DEC-058) and are denied the
 * same non-enumerating way as a missing/wrong-Provider membership. Fail
 * closed on cross-Provider and missing capability; never grant
 * ownership-transfer or membership-admin through this matrix.
 */
export function decideProviderAvailabilityManagementAuthorization(
  facts: ProviderAvailabilityManagementFacts,
): ProviderAvailabilityAuthorizationDecision {
  if (!facts.sameProvider) {
    return { allowed: false, denialCode: "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND" };
  }

  if (!facts.actorActive) {
    return { allowed: false, denialCode: "PROVIDER_AVAILABILITY_POLICY_FORBIDDEN" };
  }

  if (!facts.providerApproved) {
    return {
      allowed: false,
      denialCode: "PROVIDER_AVAILABILITY_POLICY_PROVIDER_STATE_INVALID",
    };
  }

  if (!facts.membershipActive) {
    // Same path Provider without an active membership: non-enumerating deny.
    return { allowed: false, denialCode: "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND" };
  }

  if (facts.managementLevel === "OWNER") {
    // DEC-058: an active, exact-scope Owner is trusted without an enabled
    // `provider_admin` capability.
    return { allowed: true };
  }

  if (facts.managementLevel === "ADMIN") {
    if (!facts.providerAdminEnabled) {
      return { allowed: false, denialCode: "PROVIDER_AVAILABILITY_POLICY_FORBIDDEN" };
    }
    return { allowed: true };
  }

  // Workers, Team Supervisors and any other membership level: no Phase 10
  // authority (DEC-058), denied the same non-enumerating way.
  return { allowed: false, denialCode: "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND" };
}

export type CoverageValidationError =
  | "DUPLICATE_SELECTION"
  | "EMPTY_SELECTION_LIST"
  | "TOO_MANY_SELECTIONS";

const MAX_COVERAGE_SELECTIONS = 200;

/**
 * @desc Validate structural shape of a coverage-replace request.
 * @explanation City/district existence, activity and same-country ownership
 * are verified against Configuration facts by the service, not here.
 */
export function validateCoverageSelections(
  selections: readonly CoverageSelectionInput[],
): CoverageValidationError | null {
  if (selections.length === 0) {
    return "EMPTY_SELECTION_LIST";
  }
  if (selections.length > MAX_COVERAGE_SELECTIONS) {
    return "TOO_MANY_SELECTIONS";
  }
  const seen = new Set<string>();
  for (const selection of selections) {
    const key = `${selection.type}:${selection.id}`;
    if (seen.has(key)) {
      return "DUPLICATE_SELECTION";
    }
    seen.add(key);
  }
  return null;
}

export interface CoverageMatchFacts {
  readonly coverageCityIds: readonly string[];
  readonly coverageDistrictIds: readonly string[];
}

export interface DistrictMatchTarget {
  readonly districtId: string;
  readonly cityId: string;
  readonly districtActive: boolean;
  readonly cityActive: boolean;
  readonly countryActive: boolean;
}

/**
 * @desc Decide whether a Provider's textual coverage matches one district.
 * @explanation Whole-city coverage dynamically includes every currently
 * active district (including districts added after coverage was set).
 * Inactive country/city/district ancestry always stops matching, even when the
 * exact id was previously selected (DEC-056).
 */
export function matchesProviderCoverage(
  facts: CoverageMatchFacts,
  target: DistrictMatchTarget,
): boolean {
  if (!target.countryActive || !target.cityActive || !target.districtActive) {
    return false;
  }
  if (facts.coverageDistrictIds.includes(target.districtId)) {
    return true;
  }
  return facts.coverageCityIds.includes(target.cityId);
}
