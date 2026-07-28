import { authenticationError } from "./authentication.errors.js";
import type { AccountCategory } from "./authentication.types.js";

export const SELF_SIGNUP_CATEGORIES: readonly AccountCategory[] = [
  "INDIVIDUAL",
  "COMPANY",
  "ENGINEER",
  "PROVIDER_OWNER",
];

export function assertSelfSignupCategory(category: AccountCategory): void {
  if (category === "WORKER" || !SELF_SIGNUP_CATEGORIES.includes(category)) {
    throw authenticationError("AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED");
  }
}

export function pendingCategories(
  enrolled: readonly AccountCategory[],
  verified: readonly AccountCategory[],
): readonly AccountCategory[] {
  return enrolled.filter((category) => !verified.includes(category));
}
