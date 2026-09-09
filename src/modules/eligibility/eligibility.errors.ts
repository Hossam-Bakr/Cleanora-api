/**
 * Eligibility runtime error class (R1-P11 Batch B).
 *
 * Implements the public `EligibilityError` interface declared in
 * `eligibility.public.ts` (DEC-084). Used by persistence and later service
 * layers; HTTP mapping is out of scope for Batch B.
 */

import type {
  EligibilityError as EligibilityErrorContract,
  EligibilityErrorCode,
} from "./eligibility.public.js";

const DEFAULT_MESSAGES: Record<EligibilityErrorCode, string> = {
  VALIDATION_FAILED: "Eligibility request validation failed",
  UNSUPPORTED_GEO_INPUT: "Unsupported geo input for eligibility evaluation",
  RULE_VERSION_UNAVAILABLE: "No compatible eligibility rule version is available",
  RULE_VERSION_INVALID: "Selected eligibility rule version is invalid",
  DEPENDENCY_FAILURE: "An eligibility dependency failed",
  INVALID_DEPENDENCY_DTO: "An eligibility dependency returned an invalid DTO",
  EVALUATION_LIMIT_EXCEEDED: "Eligibility evaluation limits were exceeded",
  TRANSACTION_CONFLICT_EXHAUSTED:
    "Eligibility could not obtain a consistent snapshot after retries",
  PERSISTENCE_FAILED: "Eligibility persistence failed",
  CONFLICT: "Eligibility operation conflicted with concurrent state",
};

/**
 * @desc Construct a typed Eligibility error with a stable public code.
 * @access Module-internal / composition
 * @explanation Satisfies the public EligibilityError interface without
 * leaking Prisma or SQL details through `details`.
 */
export class EligibilityError
  extends Error
  implements EligibilityErrorContract
{
  public readonly code: EligibilityErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: EligibilityErrorCode,
    options?: {
      readonly message?: string;
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    },
  ) {
    super(options?.message ?? DEFAULT_MESSAGES[code], {
      cause: options?.cause,
    });
    this.name = "EligibilityError";
    this.code = code;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

/**
 * @desc Type guard for EligibilityError instances.
 * @access Module-internal
 */
export function isEligibilityError(error: unknown): error is EligibilityError {
  return error instanceof EligibilityError;
}

/**
 * @desc Factory helper matching common module error style.
 * @access Module-internal
 */
export function eligibilityError(
  code: EligibilityErrorCode,
  details?: Readonly<Record<string, unknown>>,
  message?: string,
): EligibilityError {
  return new EligibilityError(code, {
    ...(details === undefined ? {} : { details }),
    ...(message === undefined ? {} : { message }),
  });
}
