import { authenticationError } from "./authentication.errors.js";
import type {
  AccountCategory,
  AuthDeliveryChannel,
  IdentityState,
} from "./authentication.types.js";

export type OtpPurpose =
  | "CATEGORY_VERIFICATION"
  | "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION";

export interface VerificationTarget {
  readonly userId: string;
  readonly category: AccountCategory;
  readonly purpose: OtpPurpose;
  readonly channel: AuthDeliveryChannel;
  readonly destination: string;
}

/** Derive the only verification target allowed by the identity's stored state. */
export function verificationTarget(
  identity: IdentityState,
  category: AccountCategory,
  purpose: OtpPurpose,
): VerificationTarget {
  if (!identity.accountCategories.includes(category) || category === "WORKER")
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  if (purpose !== "CATEGORY_VERIFICATION")
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  if (identity.verifiedCategories.includes(category))
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  if (identity.emailNormalized === null)
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  return {
    userId: identity.id,
    category,
    purpose,
    channel: "EMAIL",
    destination: identity.emailNormalized,
  };
}

/** Bind a stored challenge to its exact user, category, purpose, channel, and destination. */
export function assertVerificationChallengeTarget(
  target: VerificationTarget,
  challenge: {
    readonly userId: string;
    readonly accountCategory: AccountCategory;
    readonly purpose: OtpPurpose;
    readonly channel: AuthDeliveryChannel;
    readonly destinationHash: string;
  },
  expectedDestinationHash: string,
): void {
  if (
    challenge.userId !== target.userId ||
    challenge.accountCategory !== target.category ||
    challenge.purpose !== target.purpose ||
    challenge.channel !== target.channel ||
    challenge.destinationHash !== expectedDestinationHash
  )
    throw authenticationError("AUTH_VERIFICATION_FAILED");
}
