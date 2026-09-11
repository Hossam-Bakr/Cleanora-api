import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";

const CUSTOMER_CATEGORIES = ["INDIVIDUAL", "COMPANY", "ENGINEER"] as const;

/**
 * @desc Whether the principal may create and manage browse-path bookings.
 * @access Bookings module
 */
export function isVerifiedCustomerPrincipal(
  principal: AuthenticationPrincipal | null | undefined,
): principal is AuthenticationPrincipal {
  if (principal === undefined || principal === null) {
    return false;
  }
  if (principal.verificationOnly || principal.invitationOnboardingOnly === true) {
    return false;
  }
  if (principal.status !== "ACTIVE") {
    return false;
  }
  return principal.verifiedCategories.some((category) =>
    (CUSTOMER_CATEGORIES as readonly string[]).includes(category),
  );
}

export function bookingPrerequisitesFor(
  principal: AuthenticationPrincipal | null,
): {
  readonly bookingAvailable: boolean;
  readonly requiresVerifiedCustomer: true;
  readonly phase: "R1-P13";
} {
  return {
    bookingAvailable: isVerifiedCustomerPrincipal(principal),
    requiresVerifiedCustomer: true,
    phase: "R1-P13",
  };
}
