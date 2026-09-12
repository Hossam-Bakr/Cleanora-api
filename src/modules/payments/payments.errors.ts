import type {
  PaymentsErrorCode,
  PaymentsError as PaymentsErrorContract,
} from "./payments.public.js";

const DEFAULT_MESSAGES: Record<PaymentsErrorCode, string> = {
  VALIDATION_FAILED: "Payments request validation failed",
  JOURNAL_UNBALANCED: "Journal debits must equal credits",
  CURRENCY_MISMATCH: "Journal currency does not match seeded accounts",
  ACCOUNT_NOT_SEEDED: "Required system ledger accounts are not seeded",
  ENTRY_TYPE_NOT_POSTABLE: "Entry type cannot be posted in this phase",
  LINK_KIND_NOT_AVAILABLE: "Ledger link kind is not available",
  IDEMPOTENCY_CONFLICT: "Idempotency key was reused with a different payload",
  DEPENDENCY_FAILURE: "A payments dependency failed",
  ADJUSTMENT_REASON_REQUIRED: "Adjustments require a staff-finance reason",
  WALLET_PROHIBITED: "Stored-value user accounts are prohibited",
  SNAPSHOT_HASH_MISMATCH: "Financial snapshot hash does not match included entries",
};

/**
 * @desc Typed payments error with a stable public code.
 * @access Module-internal / composition
 */
export class PaymentsError extends Error implements PaymentsErrorContract {
  public readonly code: PaymentsErrorCode;
  public readonly details?: Readonly<Record<string, unknown>>;

  public constructor(
    code: PaymentsErrorCode,
    options?: {
      readonly message?: string;
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    },
  ) {
    super(options?.message ?? DEFAULT_MESSAGES[code], {
      cause: options?.cause,
    });
    this.name = "PaymentsError";
    this.code = code;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

/**
 * @desc Type guard for PaymentsError instances.
 * @access Approved cross-module mapping
 */
export function isPaymentsError(error: unknown): error is PaymentsError {
  return error instanceof PaymentsError;
}

/**
 * @desc Factory matching other module error helpers.
 * @access Module-internal
 */
export function paymentsError(
  code: PaymentsErrorCode,
  details?: Readonly<Record<string, unknown>>,
): PaymentsError {
  return new PaymentsError(code, details === undefined ? {} : { details });
}
