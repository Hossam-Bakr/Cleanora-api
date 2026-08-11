import { AppError } from "#shared/errors/app-error";

/**
 * Stable Provider HTTP/domain error catalog from contracts/provider-api.md.
 * Details must stay free of contacts, tokens, storage ids, and stack traces.
 */
export type ProvidersErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "PROVIDER_ELIGIBILITY_DENIED"
  | "PROVIDER_ACCESS_DENIED"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_ALREADY_EXISTS"
  | "PROVIDER_VERSION_CONFLICT"
  | "PROVIDER_STATE_CONFLICT"
  | "PROVIDER_SUBMISSION_INCOMPLETE"
  | "PROVIDER_REASON_REQUIRED"
  | "PROVIDER_MEDIA_INVALID"
  | "PROVIDER_MEDIA_LIMIT_EXCEEDED"
  | "PROVIDER_INVITATION_CONFLICT"
  | "PROVIDER_INVITATION_INVALID"
  | "PROVIDER_INVITATION_EMAIL_MISMATCH"
  | "PROVIDER_MEMBER_NOT_FOUND"
  | "PROVIDER_DEPENDENCY_UNAVAILABLE";

const DEFINITIONS: Record<
  ProvidersErrorCode,
  { readonly message: string; readonly statusCode: number }
> = {
  VALIDATION_ERROR: {
    message: "Request validation failed",
    statusCode: 400,
  },
  AUTHENTICATION_REQUIRED: {
    message: "Authentication is required",
    statusCode: 401,
  },
  PROVIDER_ELIGIBILITY_DENIED: {
    message: "Provider eligibility requirements are not met",
    statusCode: 403,
  },
  PROVIDER_ACCESS_DENIED: {
    message: "Provider access is not available",
    statusCode: 403,
  },
  PROVIDER_NOT_FOUND: {
    message: "Provider is not available",
    statusCode: 404,
  },
  PROVIDER_ALREADY_EXISTS: {
    message: "A Provider already exists for this account",
    statusCode: 409,
  },
  PROVIDER_VERSION_CONFLICT: {
    message: "Provider changed concurrently",
    statusCode: 409,
  },
  PROVIDER_STATE_CONFLICT: {
    message: "Provider state does not allow this action",
    statusCode: 409,
  },
  PROVIDER_SUBMISSION_INCOMPLETE: {
    message: "Provider submission requirements are incomplete",
    statusCode: 409,
  },
  PROVIDER_REASON_REQUIRED: {
    message: "A reason is required for this action",
    statusCode: 400,
  },
  PROVIDER_MEDIA_INVALID: {
    message: "Provider media is invalid",
    statusCode: 400,
  },
  PROVIDER_MEDIA_LIMIT_EXCEEDED: {
    message: "Provider media limit exceeded",
    statusCode: 409,
  },
  PROVIDER_INVITATION_CONFLICT: {
    message: "Provider invitation conflicts with current state",
    statusCode: 409,
  },
  PROVIDER_INVITATION_INVALID: {
    message: "Provider invitation is not valid",
    statusCode: 410,
  },
  PROVIDER_INVITATION_EMAIL_MISMATCH: {
    message: "Authenticated email does not match the invitation",
    statusCode: 403,
  },
  PROVIDER_MEMBER_NOT_FOUND: {
    message: "Provider member is not available",
    statusCode: 404,
  },
  PROVIDER_DEPENDENCY_UNAVAILABLE: {
    message: "A required Provider dependency is unavailable",
    statusCode: 503,
  },
};

export function providersError(
  code: ProvidersErrorCode,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  const definition = DEFINITIONS[code];
  return new AppError({
    code,
    message: definition.message,
    statusCode: definition.statusCode,
    expose: true,
    ...(details === undefined ? {} : { details }),
  });
}
