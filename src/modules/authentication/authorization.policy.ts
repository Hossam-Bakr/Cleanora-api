import type { AuthenticationPrincipal } from "./domain/authentication.types.js";
import type {
  OwnershipFact,
  OwnershipRule,
  ScopeFact,
  ScopeRule,
} from "./domain/authorization.types.js";

export const R1_P06_STAFF_PERMISSIONS = [
  "providers.verification.documents.review",
  "providers.verification.policies.manage",
  "providers.payout-destinations.verify",
] as const;

export function assertR1P06StaffPermission(input: {
  readonly accountActive: boolean;
  readonly staffAdminEnabled: boolean;
  readonly permissionCodes: readonly string[];
  readonly requiredPermission: (typeof R1_P06_STAFF_PERMISSIONS)[number];
}): void {
  if (!input.accountActive || !input.staffAdminEnabled || !input.permissionCodes.includes(input.requiredPermission)) {
    throw new Error("PROVIDER_SCOPE_DENIED");
  }
}

/**
 * Pure ownership and scope rules. These functions never read the database and
 * never trust a client-supplied claim: every fact is established by the server
 * before it reaches this file.
 */

/**
 * Authorization requires an active account that finished its verification gate.
 * Suspended, banned, and verification-only principals are denied.
 */
export function isAccountStateUsableForAuthorization(
  principal: AuthenticationPrincipal,
): boolean {
  return principal.status === "ACTIVE" && !principal.verificationOnly;
}

/** A `SELF` ownership fact passes only for the principal's own resource. */
export function isOwnershipFactSatisfied(
  principal: AuthenticationPrincipal,
  fact: OwnershipFact,
): boolean {
  return fact.resourceOwnerUserId === principal.userId;
}

/**
 * Scope facts.
 *
 * Provider membership records and worker records do not exist in R1-P03, so a
 * production caller cannot supply `memberProviderId` or `workerRecordUserId`
 * and every such decision denies. Tests supply synthetic facts to prove the
 * rules, including cross-provider denial.
 */
export function isScopeFactSatisfied(fact: ScopeFact): boolean {
  switch (fact.kind) {
    case "GLOBAL":
      return true;
    case "PROVIDER":
      if (fact.memberProviderId === undefined) {
        return false;
      }
      return fact.memberProviderId === fact.requestedProviderId;
    case "WORKER":
      if (fact.workerRecordUserId === undefined) {
        return false;
      }
      return fact.workerRecordUserId === fact.requestedWorkerUserId;
  }
}

/** A declared `SELF` ownership rule requires a matching ownership fact. */
export function isOwnershipRuleSatisfied(
  rule: OwnershipRule,
  principal: AuthenticationPrincipal,
  fact: OwnershipFact | undefined,
): boolean {
  if (rule === "NONE") {
    return true;
  }
  if (fact === undefined) {
    return false;
  }
  return isOwnershipFactSatisfied(principal, fact);
}

/**
 * A declared scope rule requires a matching scope fact, except `GLOBAL`, which
 * is platform-wide and needs no provider or worker fact.
 */
export function isScopeRuleSatisfied(
  rule: ScopeRule,
  fact: ScopeFact | undefined,
): boolean {
  if (rule === "NONE") {
    return true;
  }
  if (rule === "GLOBAL") {
    return fact === undefined || fact.kind === "GLOBAL";
  }
  if (fact === undefined) {
    return false;
  }
  if (rule === "PROVIDER") {
    return fact.kind === "PROVIDER" && isScopeFactSatisfied(fact);
  }
  return fact.kind === "WORKER" && isScopeFactSatisfied(fact);
}
