import type {
  PrivacyRequestOutcomeCode,
  PrivacyRequestStatus,
} from "./customers.types.js";

export function isClosedOutcome(
  status: "COMPLETED" | "REJECTED",
  outcomeCode: PrivacyRequestOutcomeCode,
): boolean {
  return (
    (status === "COMPLETED" && outcomeCode === "REQUEST_FULFILLED") ||
    (status === "REJECTED" && outcomeCode === "REQUEST_REJECTED")
  );
}

export function isTerminalPrivacyStatus(status: PrivacyRequestStatus): boolean {
  return status === "COMPLETED" || status === "REJECTED" || status === "CANCELLED";
}

export function canCancelPrivacyRequest(status: PrivacyRequestStatus): boolean {
  return status === "PENDING";
}
