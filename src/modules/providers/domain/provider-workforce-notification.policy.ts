import type { WorkforceLocale, WorkforceNotificationIntentInput } from "./provider-workforce.types.js";
import { WorkforcePolicyError } from "./provider-workforce.policy.js";

export function resolveWorkforceLocale(input: {
  readonly preferredLanguage: string | null | undefined;
  readonly acceptedInvitationLocale: WorkforceLocale | null | undefined;
}): WorkforceLocale {
  if (input.preferredLanguage === "AR" || input.preferredLanguage === "EN") {
    return input.preferredLanguage;
  }
  return input.acceptedInvitationLocale ?? "AR";
}

const SAFE_VARIABLE_KEYS = new Set([
  "invitationVersion",
  "membershipVersion",
  "reasonCode",
  "workerId",
  "workerVersion",
]);
const SAFE_REASON_CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;

export function assertSafeNotificationIntent(input: WorkforceNotificationIntentInput): void {
  const hasUser = input.recipientUserId !== undefined;
  const hasEmail = input.recipientEmailNormalized !== undefined;
  if (hasUser === hasEmail) throw new WorkforcePolicyError("WORKFORCE_NOTIFICATION_RECIPIENT_INVALID");
  for (const [key, value] of Object.entries(input.safeVariables)) {
    if (!SAFE_VARIABLE_KEYS.has(key)
      || (key.endsWith("Version") && (!Number.isSafeInteger(value) || Number(value) <= 0))
      || (key === "workerId" && (typeof value !== "string" || !SAFE_IDENTIFIER.test(value)))
      || (key === "reasonCode" && (typeof value !== "string" || !SAFE_REASON_CODE.test(value)))) {
      throw new WorkforcePolicyError("WORKFORCE_NOTIFICATION_UNSAFE");
    }
  }
}
