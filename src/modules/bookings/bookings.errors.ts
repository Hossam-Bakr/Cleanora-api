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

export type BookingAssignmentErrorCode =
  | "BOOKING_ASSIGNMENT_FORBIDDEN"
  | "BOOKING_ASSIGNMENT_INVALID_STATE"
  | "BOOKING_ASSIGNMENT_TEAM_MISMATCH"
  | "BOOKING_ASSIGNMENT_CREW_MISMATCH"
  | "BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN"
  | "BOOKING_ASSIGNMENT_COMPOSITION_INVALID"
  | "BOOKING_ASSIGNMENT_SCHEDULE_UNAVAILABLE"
  | "BOOKING_ASSIGNMENT_WORKER_CONFLICT"
  | "BOOKING_ASSIGNMENT_VERSION_CONFLICT"
  | "BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT"
  | "BOOKING_ASSIGNMENT_DUPLICATE_WORKER"
  | "BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS"
  | "BOOKING_ASSIGNMENT_NOT_FOUND"
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_REQUIRED"
  | "NOT_FOUND";

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

const ASSIGNMENT_STATUS: Record<BookingAssignmentErrorCode, number> = {
  BOOKING_ASSIGNMENT_FORBIDDEN: 403,
  BOOKING_ASSIGNMENT_INVALID_STATE: 409,
  BOOKING_ASSIGNMENT_TEAM_MISMATCH: 409,
  BOOKING_ASSIGNMENT_CREW_MISMATCH: 409,
  BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN: 409,
  BOOKING_ASSIGNMENT_COMPOSITION_INVALID: 409,
  BOOKING_ASSIGNMENT_SCHEDULE_UNAVAILABLE: 409,
  BOOKING_ASSIGNMENT_WORKER_CONFLICT: 409,
  BOOKING_ASSIGNMENT_VERSION_CONFLICT: 409,
  BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT: 409,
  BOOKING_ASSIGNMENT_DUPLICATE_WORKER: 409,
  BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS: 409,
  BOOKING_ASSIGNMENT_NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  AUTHENTICATION_REQUIRED: 401,
  NOT_FOUND: 404,
};

const ASSIGNMENT_MESSAGES: Record<BookingAssignmentErrorCode, string> = {
  BOOKING_ASSIGNMENT_FORBIDDEN: "Assignment is forbidden for this actor",
  BOOKING_ASSIGNMENT_INVALID_STATE: "Booking is not in an assignable state",
  BOOKING_ASSIGNMENT_TEAM_MISMATCH: "Team must match the booking selected team",
  BOOKING_ASSIGNMENT_CREW_MISMATCH: "Assignment does not match crew preference",
  BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN: "Escort members cannot clean",
  BOOKING_ASSIGNMENT_COMPOSITION_INVALID: "Assignment composition is invalid",
  BOOKING_ASSIGNMENT_SCHEDULE_UNAVAILABLE: "Worker schedule does not cover the booking window",
  BOOKING_ASSIGNMENT_WORKER_CONFLICT: "Worker has an overlapping active assignment",
  BOOKING_ASSIGNMENT_VERSION_CONFLICT: "Booking version conflict",
  BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT: "Idempotency key reused with a different body",
  BOOKING_ASSIGNMENT_DUPLICATE_WORKER: "Duplicate worker ids are not allowed",
  BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS: "Not enough cleaning workers for required team units",
  BOOKING_ASSIGNMENT_NOT_FOUND: "Assignment was not found",
  VALIDATION_FAILED: "Booking request validation failed",
  AUTHENTICATION_REQUIRED: "Authentication is required",
  NOT_FOUND: "Booking was not found",
};

/**
 * @desc Create a safe booking-assignment HTTP AppError.
 * @access Bookings module
 */
export function bookingAssignmentError(
  code: BookingAssignmentErrorCode,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return new AppError({
    code,
    message: ASSIGNMENT_MESSAGES[code],
    statusCode: ASSIGNMENT_STATUS[code],
    ...(details === undefined ? {} : { details }),
  });
}
