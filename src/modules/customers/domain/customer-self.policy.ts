import type {
  AccountCategory,
  AuthenticationPrincipal,
} from "../../authentication/authentication.public.js";

/** Supported R1-P04 customer enrollment categories (not roles). */
export const SUPPORTED_CUSTOMER_CATEGORIES = [
  "INDIVIDUAL",
  "COMPANY",
  "ENGINEER",
] as const satisfies readonly AccountCategory[];

export type SupportedCustomerCategory =
  (typeof SUPPORTED_CUSTOMER_CATEGORIES)[number];

export type CustomerSelfPolicyFamily =
  | "categoryProfile"
  | "sharedImageOrAddress"
  | "contactPrefsPrivacy";

export type CustomerSelfDenialCode =
  | "IDENTITY_NOT_ACTIVE"
  | "CATEGORY_NOT_VERIFIED"
  | "CATEGORY_NOT_ENROLLED"
  | "OWNERSHIP_DENIED";

export interface CustomerSelfPolicyDecision {
  readonly allowed: boolean;
  readonly denialCode?: CustomerSelfDenialCode;
}

export interface CustomerSelfPolicyInput {
  readonly principal: AuthenticationPrincipal;
  readonly resourceOwnerUserId: string;
  /** Required for category-profile family; ignored by other families. */
  readonly category?: AccountCategory;
}

function isSupportedCustomerCategory(
  category: AccountCategory,
): category is SupportedCustomerCategory {
  return (SUPPORTED_CUSTOMER_CATEGORIES as readonly AccountCategory[]).includes(
    category,
  );
}

function hasVerifiedSupportedCategory(
  principal: AuthenticationPrincipal,
): boolean {
  return principal.verifiedCategories.some(isSupportedCustomerCategory);
}

function hasEnrolledSupportedCategory(
  principal: AuthenticationPrincipal,
): boolean {
  return principal.accountCategories.some(isSupportedCustomerCategory);
}

function assertSelfOwnership(
  principal: AuthenticationPrincipal,
  resourceOwnerUserId: string,
): CustomerSelfPolicyDecision | undefined {
  if (principal.userId !== resourceOwnerUserId) {
    return { allowed: false, denialCode: "OWNERSHIP_DENIED" };
  }
  return undefined;
}

function assertActiveIdentity(
  principal: AuthenticationPrincipal,
): CustomerSelfPolicyDecision | undefined {
  if (principal.status !== "ACTIVE") {
    return { allowed: false, denialCode: "IDENTITY_NOT_ACTIVE" };
  }
  return undefined;
}

/**
 * FR-028 category-profile family: ACTIVE identity, matching verified supported
 * category, and SELF ownership. Eligibility loss denies access only; it does
 * not imply data deletion.
 */
export function authorizeCategoryProfileSelf(
  input: CustomerSelfPolicyInput,
): CustomerSelfPolicyDecision {
  const ownership = assertSelfOwnership(
    input.principal,
    input.resourceOwnerUserId,
  );
  if (ownership !== undefined) {
    return ownership;
  }

  const active = assertActiveIdentity(input.principal);
  if (active !== undefined) {
    return active;
  }

  if (
    input.category === undefined ||
    !isSupportedCustomerCategory(input.category) ||
    !input.principal.verifiedCategories.includes(input.category)
  ) {
    return { allowed: false, denialCode: "CATEGORY_NOT_VERIFIED" };
  }

  return { allowed: true };
}

/**
 * FR-028 shared image / address family: ACTIVE identity, at least one verified
 * supported category, and SELF ownership.
 */
export function authorizeSharedImageOrAddressSelf(
  input: CustomerSelfPolicyInput,
): CustomerSelfPolicyDecision {
  const ownership = assertSelfOwnership(
    input.principal,
    input.resourceOwnerUserId,
  );
  if (ownership !== undefined) {
    return ownership;
  }

  const active = assertActiveIdentity(input.principal);
  if (active !== undefined) {
    return active;
  }

  if (!hasVerifiedSupportedCategory(input.principal)) {
    return { allowed: false, denialCode: "CATEGORY_NOT_VERIFIED" };
  }

  return { allowed: true };
}

/**
 * FR-028 contact / preferences / privacy family: ACTIVE identity, enrolled in a
 * supported customer category (pending-only enrollment allowed), and SELF
 * ownership.
 */
export function authorizeContactPrefsPrivacySelf(
  input: CustomerSelfPolicyInput,
): CustomerSelfPolicyDecision {
  const ownership = assertSelfOwnership(
    input.principal,
    input.resourceOwnerUserId,
  );
  if (ownership !== undefined) {
    return ownership;
  }

  const active = assertActiveIdentity(input.principal);
  if (active !== undefined) {
    return active;
  }

  if (!hasEnrolledSupportedCategory(input.principal)) {
    return { allowed: false, denialCode: "CATEGORY_NOT_ENROLLED" };
  }

  return { allowed: true };
}

/** Route one FR-028 family to the matching policy helper. */
export function authorizeCustomerSelf(
  family: CustomerSelfPolicyFamily,
  input: CustomerSelfPolicyInput,
): CustomerSelfPolicyDecision {
  switch (family) {
    case "categoryProfile":
      return authorizeCategoryProfileSelf(input);
    case "sharedImageOrAddress":
      return authorizeSharedImageOrAddressSelf(input);
    case "contactPrefsPrivacy":
      return authorizeContactPrefsPrivacySelf(input);
    default: {
      const exhaustive: never = family;
      return exhaustive;
    }
  }
}
