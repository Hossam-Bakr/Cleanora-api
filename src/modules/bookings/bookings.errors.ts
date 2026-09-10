import { AppError } from "#shared/errors/app-error";

export type BrowseErrorCode =
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_REQUIRED"
  | "BROWSE_EVALUATION_FAILED"
  | "BROWSE_PROVIDER_NOT_FOUND"
  | "BROWSE_SERVICE_NOT_FOUND"
  | "COUNTRY_UNAVAILABLE";

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
