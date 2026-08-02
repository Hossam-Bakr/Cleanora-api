import { authenticationError } from "./authentication.errors.js";
import type {
  AccountCategory,
  AuthDeliveryChannel,
  IdentityState,
  SessionCapability,
} from "./authentication.types.js";

export const SELF_SIGNUP_CATEGORIES: readonly AccountCategory[] = [
  "INDIVIDUAL",
  "COMPANY",
  "ENGINEER",
  "PROVIDER_OWNER",
];
export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;
export const RESET_TTL_SECONDS = 1_800;
export const RESET_MAX_ATTEMPTS = 5;
export const ACCESS_TOKEN_TTL_SECONDS = 900;
export const REFRESH_TOKEN_TTL_SECONDS = 2_592_000;
export const AUTH_RATE_LIMITS = {
  signup: { ip: [10, 900], subject: [3, 3600] },
  login: { ip: [20, 900], subject: [5, 900] },
  otpSend: { ip: [10, 900], subject: [3, 900] },
  otpVerify: { ip: [20, 900] },
  forgot: { ip: [5, 900], subject: [3, 3600] },
  reset: { ip: [5, 900] },
  refresh: { ip: [60, 300], subject: [30, 300] },
  google: { ip: [20, 900] },
} as const;

const E164 = /^\+[1-9][0-9]{1,14}$/u;
const PASSWORD_MIN_LENGTH = 7;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_MAX_BYTES = 512;
const COMMON_PASSWORDS = new Set([
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "admin123",
  "cleanora",
  "cleanora1",
  "letmein",
  "password",
  "password1",
  "qwerty1",
  "qwerty123",
  "welcome",
]);

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

export function loginCapability(
  identity: IdentityState,
  now = new Date(),
): SessionCapability {
  if (
    identity.status === "BANNED" ||
    (identity.status === "SUSPENDED" &&
      (identity.suspendedUntil === null || identity.suspendedUntil > now))
  ) {
    throw authenticationError("AUTHENTICATION_FAILED");
  }
  return identity.verifiedCategories.length > 0
    ? "FULL"
    : "VERIFICATION_ONLY";
}

export function isPhoneFormatValid(value: string): boolean {
  return E164.test(value.replace(/[\s()-]/gu, ""));
}

export function normalizePhone(value: string): string {
  const normalized = value.replace(/[\s()-]/gu, "");
  if (!isPhoneFormatValid(value)) {
    throw authenticationError("AUTH_PHONE_FORMAT_INVALID");
  }
  return normalized;
}

export function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)
  ) {
    throw authenticationError("AUTH_EMAIL_FORMAT_INVALID");
  }
  return normalized;
}

function isRepeatedPattern(value: string): boolean {
  for (
    let patternLength = 1;
    patternLength <= value.length / 2;
    patternLength += 1
  ) {
    if (value.length % patternLength !== 0) {
      continue;
    }
    const pattern = value.slice(0, patternLength);
    if (pattern.repeat(value.length / patternLength) === value) {
      return true;
    }
  }
  return false;
}

function isSequentialNumber(value: string): boolean {
  if (!/^\d+$/u.test(value)) {
    return false;
  }
  const digits = [...value].map(Number);
  const ascending = digits
    .slice(1)
    .every((digit, index) => digit === ((digits[index] ?? 0) + 1) % 10);
  const descending = digits
    .slice(1)
    .every((digit, index) => digit === ((digits[index] ?? 0) + 9) % 10);
  return ascending || descending;
}

export function isPasswordPolicySatisfied(password: string): boolean {
  const bytes = Buffer.byteLength(password, "utf8");
  const normalized = password.toLowerCase();
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    bytes <= PASSWORD_MAX_BYTES &&
    !COMMON_PASSWORDS.has(normalized) &&
    !isRepeatedPattern(normalized) &&
    !isSequentialNumber(normalized)
  );
}

export function assertPasswordPolicy(password: string): void {
  if (!isPasswordPolicySatisfied(password)) {
    throw authenticationError("AUTH_PASSWORD_POLICY_FAILED");
  }
}

export function isSessionActive(
  session: { readonly expiresAt: Date; readonly revokedAt: Date | null },
  now = new Date(),
): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}

export function blockingVerificationChannel(
  category: AccountCategory,
): AuthDeliveryChannel {
  void category;
  return "EMAIL";
}

export function recoveryChannel(
  category: AccountCategory,
): AuthDeliveryChannel {
  return blockingVerificationChannel(category);
}

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

export function verificationTarget(
  identity: IdentityState,
  category: AccountCategory,
  purpose: OtpPurpose,
): VerificationTarget {
  if (
    !identity.accountCategories.includes(category) ||
    category === "WORKER" ||
    purpose !== "CATEGORY_VERIFICATION" ||
    identity.verifiedCategories.includes(category) ||
    identity.emailNormalized === null
  ) {
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  }
  return {
    userId: identity.id,
    category,
    purpose,
    channel: "EMAIL",
    destination: identity.emailNormalized,
  };
}

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
  ) {
    throw authenticationError("AUTH_VERIFICATION_FAILED");
  }
}

export function maskPhoneDestination(phone: string): string {
  if (phone.length <= 6) return `***${phone.slice(-2)}`;
  return `${phone.slice(0, 3)}${"*".repeat(
    Math.max(4, phone.length - 7),
  )}${phone.slice(-4)}`;
}

export function maskEmailDestination(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visibleLocal =
    local.length <= 2
      ? `${local[0] ?? "*"}*`
      : `${local.slice(0, 2)}***`;
  const dot = domain.lastIndexOf(".");
  if (dot <= 0) return `${visibleLocal}@***`;
  return `${visibleLocal}@***${domain.slice(dot)}`;
}

export function formatDeliveryExpiry(expiresAt: Date): string {
  return `${expiresAt.toISOString()} (UTC)`;
}
