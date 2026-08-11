import { calculateProfileCompletion } from "./provider-completion.policy.js";
import type { ProviderCompletionFacts } from "./provider-completion.policy.js";
import { assertApplicationTransition } from "./provider-lifecycle.policy.js";
import { providersError } from "./providers.errors.js";
import type {
  ProfileCompletion,
  ProfileCompletionCheckCode,
  ProviderApplicationStatus,
} from "./providers.types.js";

/**
 * Application Owner may mutate profile/contact/media only while the
 * application remains editable (DRAFT or CHANGES_REQUESTED).
 */
export function canApplicationOwnerMutateContent(
  status: ProviderApplicationStatus,
): boolean {
  return status === "DRAFT" || status === "CHANGES_REQUESTED";
}

/**
 * Application Owner may submit/resubmit only from editable statuses.
 * PENDING_REVIEW matching retries are handled by the application service.
 */
export function canApplicationOwnerSubmit(
  status: ProviderApplicationStatus,
): boolean {
  return status === "DRAFT" || status === "CHANGES_REQUESTED";
}

export function nextReviewCycle(currentReviewCycle: number): number {
  if (!Number.isInteger(currentReviewCycle) || currentReviewCycle < 0) {
    throw providersError("VALIDATION_ERROR", { field: "reviewCycle" });
  }
  return currentReviewCycle + 1;
}

/**
 * Authoritative r1-p05-v1 blocker aggregation for submission.
 * Returns every unsatisfied requirement code together.
 */
export function evaluateSubmissionBlockers(
  facts: ProviderCompletionFacts,
): {
  readonly ready: boolean;
  readonly missingRequirementCodes: readonly ProfileCompletionCheckCode[];
  readonly completion: ProfileCompletion;
} {
  const completion = calculateProfileCompletion(facts);
  return {
    ready: completion.missingRequirementCodes.length === 0,
    missingRequirementCodes: completion.missingRequirementCodes,
    completion,
  };
}

export function assertCanSubmitApplication(input: {
  readonly actorIsApplicationOwner: boolean;
  readonly applicationStatus: ProviderApplicationStatus;
}): void {
  if (!input.actorIsApplicationOwner) {
    throw providersError("PROVIDER_ACCESS_DENIED");
  }
  if (!canApplicationOwnerSubmit(input.applicationStatus)) {
    throw providersError("PROVIDER_STATE_CONFLICT", {
      reason: "SUBMIT_NOT_ALLOWED",
      applicationStatus: input.applicationStatus,
    });
  }
  assertApplicationTransition(input.applicationStatus, "PENDING_REVIEW");
}
