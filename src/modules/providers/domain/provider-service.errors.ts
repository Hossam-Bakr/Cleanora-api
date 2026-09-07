/**
 * Stable Provider Service error catalog (R1-P09 HTTP + domain codes).
 * Details must stay free of contacts, tokens, pending leaks, and stack traces.
 */

import { AppError } from "#shared/errors/app-error";

export type ProviderServiceErrorCode =
  | "REQUEST_VALIDATION_FAILED"
  | "PROVIDER_SERVICE_PRICE_INVALID"
  | "PROVIDER_SERVICE_FORBIDDEN"
  | "PROVIDER_SERVICE_NOT_FOUND"
  | "PROVIDER_SERVICE_PROVIDER_STATE_INVALID"
  | "PROVIDER_SERVICE_ALREADY_EXISTS"
  | "PROVIDER_SERVICE_VERSION_CONFLICT"
  | "PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT"
  | "PROVIDER_SERVICE_CATALOG_UNAVAILABLE"
  | "PROVIDER_SERVICE_PRICE_UNIT_UNAVAILABLE"
  | "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE"
  | "PROVIDER_SERVICE_ENABLE_BLOCKED"
  | "PROVIDER_SERVICE_PRICE_APPROVAL_NOT_REQUIRED"
  | "PROVIDER_SERVICE_PRICE_NOT_PENDING"
  | "PROVIDER_SERVICE_PRICE_TRANSITION_ILLEGAL"
  | "PROVIDER_SERVICE_SNAPSHOT_CONFLICT"
  | "PROVIDER_SERVICE_DEPENDENCY_FAILED";

const DEFINITIONS: Record<
  ProviderServiceErrorCode,
  { readonly message: string; readonly statusCode: number }
> = {
  REQUEST_VALIDATION_FAILED: {
    message: "Request validation failed",
    statusCode: 400,
  },
  PROVIDER_SERVICE_PRICE_INVALID: {
    message: "Provider service price is invalid",
    statusCode: 400,
  },
  PROVIDER_SERVICE_FORBIDDEN: {
    message: "Provider service access is not available",
    statusCode: 403,
  },
  PROVIDER_SERVICE_NOT_FOUND: {
    message: "Provider service is not available",
    statusCode: 404,
  },
  PROVIDER_SERVICE_PROVIDER_STATE_INVALID: {
    message: "Provider state does not allow this service operation",
    statusCode: 409,
  },
  PROVIDER_SERVICE_ALREADY_EXISTS: {
    message: "Provider service offering already exists",
    statusCode: 409,
  },
  PROVIDER_SERVICE_VERSION_CONFLICT: {
    message: "Provider service changed concurrently",
    statusCode: 409,
  },
  PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT: {
    message: "Idempotency key conflicts with a prior request",
    statusCode: 409,
  },
  PROVIDER_SERVICE_CATALOG_UNAVAILABLE: {
    message: "Catalog service is not currently selectable",
    statusCode: 409,
  },
  PROVIDER_SERVICE_PRICE_UNIT_UNAVAILABLE: {
    message: "Selected price unit is not currently available",
    statusCode: 409,
  },
  PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE: {
    message: "Provider service pricing configuration is unavailable",
    statusCode: 503,
  },
  PROVIDER_SERVICE_ENABLE_BLOCKED: {
    message: "Provider service cannot be enabled",
    statusCode: 409,
  },
  PROVIDER_SERVICE_PRICE_APPROVAL_NOT_REQUIRED: {
    message: "Staff price decision is not required by current policy",
    statusCode: 409,
  },
  PROVIDER_SERVICE_PRICE_NOT_PENDING: {
    message: "Provider service price is not pending a decision",
    statusCode: 409,
  },
  PROVIDER_SERVICE_PRICE_TRANSITION_ILLEGAL: {
    message: "Provider service price transition is not allowed",
    statusCode: 409,
  },
  PROVIDER_SERVICE_SNAPSHOT_CONFLICT: {
    message: "Provider service snapshot consistency conflict",
    statusCode: 409,
  },
  PROVIDER_SERVICE_DEPENDENCY_FAILED: {
    message: "A required Provider service dependency failed",
    statusCode: 502,
  },
};

/**
 * Typed domain/application error for Provider Service workflows.
 * Prefer {@link providerServiceError} at HTTP boundaries.
 */
export class ProviderServiceError extends Error {
  readonly code: ProviderServiceErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly httpStatus: number;

  constructor(
    code: ProviderServiceErrorCode,
    message?: string,
    options?: {
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    },
  ) {
    const definition = DEFINITIONS[code];
    super(message ?? definition.message, {
      cause: options?.cause,
    });
    this.name = "ProviderServiceError";
    this.code = code;
    this.details = options?.details;
    this.httpStatus = definition.statusCode;
  }
}

export function providerServiceError(
  code: ProviderServiceErrorCode,
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

export function providerServiceErrorToAppError(
  error: ProviderServiceError,
): AppError {
  if (error.code === "PROVIDER_SERVICE_SNAPSHOT_CONFLICT") {
    return providerServiceError("PROVIDER_SERVICE_VERSION_CONFLICT");
  }
  return new AppError({
    code: error.code,
    message: error.message,
    statusCode: error.httpStatus,
    expose: true,
    ...(error.details === undefined ? {} : { details: { ...error.details } }),
  });
}

export function rethrowProviderServiceAsAppError(error: unknown): never {
  if (error instanceof ProviderServiceError) {
    throw providerServiceErrorToAppError(error);
  }
  throw error;
}
