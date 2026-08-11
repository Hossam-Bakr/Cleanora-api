import type {
  ProviderApplicationStatus,
  ProviderMembershipLevel,
  ProviderMembershipStatus,
  ProviderOperationalStatus,
} from "./providers.types.js";

/**
 * Exact-scope authorization helpers for Provider resources.
 *
 * Facts must be built only from authoritative identity, membership, and
 * Provider rows. Caller-supplied membership, provider scope claims, Staff
 * flags, or actor ids from the request body MUST NEVER be copied into
 * {@link ProviderAuthorizationFacts}.
 *
 * Global `provider_admin` alone never grants Provider access (FR-052, FR-053).
 */
export type ProviderActorRelationship =
  | "APPLICATION_OWNER"
  | "OWNER"
  | "ADMIN"
  | "STAFF"
  | "NONE";

export type ProviderOperation =
  | "READ_PROFILE"
  | "READ_CONTACTS"
  | "READ_PREVIEW"
  | "READ_PROJECTIONS"
  | "EDIT_PROFILE_OR_CONTACTS"
  | "MUTATE_PRE_APPROVAL"
  | "SUBMIT"
  | "MANAGE_INVITATIONS"
  | "MANAGE_MEMBERS"
  | "MANAGE_AS_OWNER";

export interface ProviderAuthorizationFacts {
  readonly actorUserId: string;
  readonly actorActive: boolean;
  readonly applicationOwnerUserId: string;
  readonly membership: {
    readonly level: ProviderMembershipLevel;
    readonly status: ProviderMembershipStatus;
  } | null;
  readonly staffAdmin: boolean;
  readonly providerAdminEnabled: boolean;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
}

export type ProviderAuthorizationDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly denialCode:
        | "PROVIDER_NOT_FOUND"
        | "PROVIDER_ACCESS_DENIED"
        | "PROVIDER_STATE_CONFLICT";
      readonly reason?: string;
    };

export function resolveActorRelationship(
  facts: ProviderAuthorizationFacts,
): ProviderActorRelationship {
  if (facts.staffAdmin) {
    return "STAFF";
  }
  if (!facts.actorActive) {
    return "NONE";
  }
  if (
    facts.actorUserId === facts.applicationOwnerUserId &&
    facts.applicationStatus !== "APPROVED"
  ) {
    return "APPLICATION_OWNER";
  }
  if (
    facts.membership !== null &&
    facts.membership.status === "ACTIVE" &&
    facts.providerAdminEnabled
  ) {
    return facts.membership.level;
  }
  return "NONE";
}

/**
 * Approved OWNER capability uses authoritative membership, not the display
 * relationship label (Application Owner still outranks OWNER in resolve).
 */
export function canManageAsOwner(facts: ProviderAuthorizationFacts): boolean {
  return isApprovedActiveOwner(facts);
}

export function canEditPostApprovalContent(
  facts: ProviderAuthorizationFacts,
): boolean {
  if (facts.applicationStatus !== "APPROVED") {
    return false;
  }
  return hasActiveOwnerOrAdminMembership(facts);
}

function hasActiveOwnerOrAdminMembership(
  facts: ProviderAuthorizationFacts,
): boolean {
  return (
    facts.actorActive &&
    facts.membership !== null &&
    facts.membership.status === "ACTIVE" &&
    facts.providerAdminEnabled &&
    (facts.membership.level === "OWNER" || facts.membership.level === "ADMIN")
  );
}

/**
 * Application Owner may mutate while DRAFT/CHANGES_REQUESTED.
 * PENDING_REVIEW and REJECTED are locked. After APPROVED, active OWNER/ADMIN
 * may mutate without leaving APPROVED.
 */
export function canEditProviderProfileOrContacts(
  facts: ProviderAuthorizationFacts,
): boolean {
  if (!facts.actorActive) {
    return false;
  }
  if (
    facts.applicationStatus === "PENDING_REVIEW" ||
    facts.applicationStatus === "REJECTED"
  ) {
    return false;
  }

  if (
    facts.applicationStatus === "DRAFT" ||
    facts.applicationStatus === "CHANGES_REQUESTED"
  ) {
    return facts.actorUserId === facts.applicationOwnerUserId;
  }

  return canEditPostApprovalContent(facts);
}

/**
 * Private contacts: Application Owner while pre-approval scoped, active
 * OWNER/ADMIN after approval, or Staff Admin for review/operations.
 */
export function canReadPrivateContacts(
  facts: ProviderAuthorizationFacts,
): boolean {
  if (facts.staffAdmin) {
    return true;
  }
  if (!facts.actorActive) {
    return false;
  }
  if (facts.actorUserId === facts.applicationOwnerUserId) {
    return (
      facts.applicationStatus === "DRAFT" ||
      facts.applicationStatus === "CHANGES_REQUESTED" ||
      facts.applicationStatus === "PENDING_REVIEW"
    );
  }
  return hasActiveOwnerOrAdminMembership(facts);
}

/** Protected contact-free preview for actors with Provider scope. */
export function canReadProviderPreview(
  facts: ProviderAuthorizationFacts,
): boolean {
  return canReadPrivateContacts(facts);
}

/**
 * Completion, readiness, history, dashboard, and settings projections share
 * the same Application Owner / active OWNER|ADMIN / Staff read scope.
 */
export function canReadProviderProjections(
  facts: ProviderAuthorizationFacts,
): boolean {
  return canReadPrivateContacts(facts);
}

/**
 * Pre-approval profile/contact/media writes: Application Owner only while
 * DRAFT or CHANGES_REQUESTED. PENDING_REVIEW is locked.
 */
export function canMutatePreApprovalContent(
  facts: ProviderAuthorizationFacts,
): boolean {
  return (
    facts.actorActive &&
    (facts.applicationStatus === "DRAFT" ||
      facts.applicationStatus === "CHANGES_REQUESTED") &&
    facts.actorUserId === facts.applicationOwnerUserId
  );
}

/**
 * Submit/resubmit is Application Owner only from editable statuses.
 */
export function canSubmitProviderApplication(
  facts: ProviderAuthorizationFacts,
): boolean {
  return (
    facts.actorActive &&
    facts.actorUserId === facts.applicationOwnerUserId &&
    (facts.applicationStatus === "DRAFT" ||
      facts.applicationStatus === "CHANGES_REQUESTED")
  );
}

function isApprovedActiveOwner(facts: ProviderAuthorizationFacts): boolean {
  if (!facts.actorActive || facts.applicationStatus !== "APPROVED") {
    return false;
  }
  return (
    facts.membership !== null &&
    facts.membership.level === "OWNER" &&
    facts.membership.status === "ACTIVE" &&
    facts.providerAdminEnabled
  );
}

/**
 * Admin invitations are unavailable before approval, during PENDING_REVIEW,
 * and after terminal REJECTED (FR-048, FR-054, FR-060; SC-014).
 */
export function canManageProviderInvitations(
  facts: ProviderAuthorizationFacts,
): boolean {
  if (
    facts.applicationStatus === "PENDING_REVIEW" ||
    facts.applicationStatus === "REJECTED" ||
    facts.applicationStatus === "DRAFT" ||
    facts.applicationStatus === "CHANGES_REQUESTED"
  ) {
    return false;
  }
  return isApprovedActiveOwner(facts);
}

/**
 * Membership management is unavailable before approval, during PENDING_REVIEW,
 * and after terminal REJECTED (FR-048, FR-054, FR-060; SC-014).
 */
export function canManageProviderMembers(
  facts: ProviderAuthorizationFacts,
): boolean {
  if (
    facts.applicationStatus === "PENDING_REVIEW" ||
    facts.applicationStatus === "REJECTED" ||
    facts.applicationStatus === "DRAFT" ||
    facts.applicationStatus === "CHANGES_REQUESTED"
  ) {
    return false;
  }
  return isApprovedActiveOwner(facts);
}

/**
 * Central allow/deny decision for Provider-scoped operations.
 * Cross-scope failures use the safe not-found denial code (FR-053).
 */
export function decideProviderOperation(
  facts: ProviderAuthorizationFacts,
  operation: ProviderOperation,
): ProviderAuthorizationDecision {
  switch (operation) {
    case "READ_PROFILE":
    case "READ_PREVIEW":
    case "READ_PROJECTIONS":
      return canReadProviderProjections(facts)
        ? { allowed: true }
        : { allowed: false, denialCode: "PROVIDER_NOT_FOUND" };
    case "READ_CONTACTS":
      return canReadPrivateContacts(facts)
        ? { allowed: true }
        : { allowed: false, denialCode: "PROVIDER_NOT_FOUND" };
    case "EDIT_PROFILE_OR_CONTACTS":
      if (canEditProviderProfileOrContacts(facts)) {
        return { allowed: true };
      }
      if (
        (facts.applicationStatus === "PENDING_REVIEW" ||
          facts.applicationStatus === "REJECTED") &&
        facts.actorUserId === facts.applicationOwnerUserId
      ) {
        return {
          allowed: false,
          denialCode: "PROVIDER_STATE_CONFLICT",
          reason:
            facts.applicationStatus === "PENDING_REVIEW"
              ? "PENDING_REVIEW_LOCKED"
              : "REJECTED_LOCKED",
        };
      }
      return { allowed: false, denialCode: "PROVIDER_NOT_FOUND" };
    case "MUTATE_PRE_APPROVAL":
      return canMutatePreApprovalContent(facts)
        ? { allowed: true }
        : {
            allowed: false,
            denialCode:
              facts.actorUserId === facts.applicationOwnerUserId
                ? "PROVIDER_STATE_CONFLICT"
                : "PROVIDER_NOT_FOUND",
          };
    case "SUBMIT":
      if (canSubmitProviderApplication(facts)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        denialCode:
          facts.actorUserId === facts.applicationOwnerUserId
            ? "PROVIDER_STATE_CONFLICT"
            : "PROVIDER_NOT_FOUND",
      };
    case "MANAGE_INVITATIONS":
      return canManageProviderInvitations(facts)
        ? { allowed: true }
        : {
            allowed: false,
            denialCode:
              facts.actorUserId === facts.applicationOwnerUserId ||
              hasActiveOwnerOrAdminMembership(facts)
                ? "PROVIDER_STATE_CONFLICT"
                : "PROVIDER_NOT_FOUND",
          };
    case "MANAGE_MEMBERS":
      return canManageProviderMembers(facts)
        ? { allowed: true }
        : {
            allowed: false,
            denialCode:
              facts.actorUserId === facts.applicationOwnerUserId ||
              hasActiveOwnerOrAdminMembership(facts)
                ? "PROVIDER_STATE_CONFLICT"
                : "PROVIDER_NOT_FOUND",
          };
    case "MANAGE_AS_OWNER":
      return canManageAsOwner(facts)
        ? { allowed: true }
        : {
            allowed: false,
            denialCode: hasActiveOwnerOrAdminMembership(facts)
              ? "PROVIDER_ACCESS_DENIED"
              : "PROVIDER_NOT_FOUND",
          };
    default: {
      const _exhaustive: never = operation;
      return _exhaustive;
    }
  }
}

/** Staff Admin review permission is evaluated via AuthorizationService. */
export const PROVIDER_APPLICATIONS_REVIEW_OPERATION =
  "providers.applications.review" as const;

/**
 * OWNER/ADMIN capability matrix after approval (FR-048–FR-053).
 * Exact membership level is required; global provider_admin alone is insufficient.
 */
export function canOwnerManageAdmins(
  facts: ProviderAuthorizationFacts,
): boolean {
  return canManageProviderMembers(facts);
}

export function canAdminEditApprovedContent(
  facts: ProviderAuthorizationFacts,
): boolean {
  return (
    facts.applicationStatus === "APPROVED" &&
    facts.membership !== null &&
    facts.membership.level === "ADMIN" &&
    facts.membership.status === "ACTIVE" &&
    facts.providerAdminEnabled
  );
}

/** ADMIN must never manage invitations, members, kind, or submission. */
export function adminForbiddenManagementCapabilities(facts: {
  readonly canInvite: boolean;
  readonly canManageMembers: boolean;
  readonly canSubmit: boolean;
  readonly canChangeKind: boolean;
}): boolean {
  return (
    !facts.canInvite &&
    !facts.canManageMembers &&
    !facts.canSubmit &&
    !facts.canChangeKind
  );
}

export function canDisableAdminMembership(input: {
  readonly actorIsApprovedOwner: boolean;
  readonly targetLevel: ProviderMembershipLevel;
  readonly targetUserId: string;
  readonly actorUserId: string;
}): boolean {
  return (
    input.actorIsApprovedOwner &&
    input.targetLevel === "ADMIN" &&
    input.targetUserId !== input.actorUserId
  );
}

/** Staff Admin operational suspend/reinstate permission. */
export const PROVIDER_LIFECYCLE_MANAGE_OPERATION =
  "providers.lifecycle.manage" as const;
