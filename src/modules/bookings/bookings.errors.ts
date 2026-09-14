import { AppError } from "#shared/errors/app-error";

export type BrowseErrorCode =
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_REQUIRED"
  | "BROWSE_EVALUATION_FAILED"
  | "BROWSE_PROVIDER_NOT_FOUND"
  | "BROWSE_SERVICE_NOT_FOUND"
  | "COUNTRY_UNAVAILABLE";

export type BookingCommandErrorCode =
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_ELIGIBLE"
  | "CONFLICT"
  | "TRANSITION_NOT_AVAILABLE"
  | "DEPENDENCY_FAILURE"
  | "DEPOSIT_PERCENT_UNAVAILABLE"
  | "RESPONSE_EXPIRED"
  | "IDEMPOTENCY_BODY_MISMATCH";

const STATUS: Record<BrowseErrorCode, number> = {
  VALIDATION_FAILED: 400,
  AUTHENTICATION_REQUIRED: 401,
  BROWSE_EVALUATION_FAILED: 503,
  BROWSE_PROVIDER_NOT_FOUND: 404,
  BROWSE_SERVICE_NOT_FOUND: 404,
  COUNTRY_UNAVAILABLE: 404,
};

const MESSAGES: Record<BrowseErrorCode, string> = {
  VALIDATION_FAILED: "Browse request validation failed",
  AUTHENTICATION_REQUIRED: "Authentication is required",
  BROWSE_EVALUATION_FAILED: "Browse eligibility evaluation failed",
  BROWSE_PROVIDER_NOT_FOUND: "Browse provider was not found",
  BROWSE_SERVICE_NOT_FOUND: "Browse service was not found",
  COUNTRY_UNAVAILABLE: "Country is unavailable",
};

/**
 * @desc Create a safe Browse HTTP AppError.
 * @access Bookings module
 */
export function browseError(
  code: BrowseErrorCode,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return new AppError({
    code,
    message: MESSAGES[code],
    statusCode: STATUS[code],
    ...(details === undefined ? {} : { details }),
  });
}

const COMMAND_STATUS: Record<BookingCommandErrorCode, number> = {
  VALIDATION_FAILED: 400,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  NOT_ELIGIBLE: 409,
  CONFLICT: 409,
  TRANSITION_NOT_AVAILABLE: 409,
  DEPENDENCY_FAILURE: 503,
  DEPOSIT_PERCENT_UNAVAILABLE: 503,
  RESPONSE_EXPIRED: 409,
  IDEMPOTENCY_BODY_MISMATCH: 409,
};

const COMMAND_MESSAGES: Record<BookingCommandErrorCode, string> = {
  VALIDATION_FAILED: "Booking request validation failed",
  AUTHENTICATION_REQUIRED: "Authentication is required",
  FORBIDDEN: "Verified customer access is required",
  NOT_FOUND: "Booking was not found",
  NOT_ELIGIBLE: "The selected provider team is not eligible",
  CONFLICT: "Booking command conflicted with current state",
  TRANSITION_NOT_AVAILABLE: "This booking transition is not available",
  DEPENDENCY_FAILURE: "A booking dependency failed",
  DEPOSIT_PERCENT_UNAVAILABLE: "Deposit percent configuration is unavailable",
  RESPONSE_EXPIRED: "The provider response window has expired",
  IDEMPOTENCY_BODY_MISMATCH: "Idempotency key was reused with a different body",
};

/**
 * @desc Create a safe booking-command HTTP AppError.
 * @access Bookings module
 */
export function bookingError(
  code: BookingCommandErrorCode,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return new AppError({
    code,
    message: COMMAND_MESSAGES[code],
    statusCode: COMMAND_STATUS[code],
    ...(details === undefined ? {} : { details }),
  });
}
