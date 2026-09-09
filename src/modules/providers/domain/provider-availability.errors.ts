import { AppError } from "#shared/errors/app-error";

export type ProviderAvailabilityErrorCode =
  | "PROVIDER_AVAILABILITY_NOT_FOUND"
  | "PROVIDER_AVAILABILITY_FORBIDDEN"
  | "PROVIDER_AVAILABILITY_PROVIDER_STATE_INVALID"
  | "PROVIDER_AVAILABILITY_VALIDATION_FAILED"
  | "PROVIDER_AVAILABILITY_COVERAGE_INVALID"
  | "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH"
  | "PROVIDER_AVAILABILITY_SCHEDULE_INVALID"
  | "PROVIDER_AVAILABILITY_PAUSE_INVALID"
  | "PROVIDER_AVAILABILITY_PAUSE_CONFLICT"
  | "PROVIDER_AVAILABILITY_VERSION_CONFLICT"
  | "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT"
  | "PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS"
  | "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED";

const DEFINITIONS: Record<
  ProviderAvailabilityErrorCode,
  { readonly message: string; readonly statusCode: number }
> = {
  PROVIDER_AVAILABILITY_NOT_FOUND: {
    message: "Provider is not available",
    statusCode: 404,
  },
  PROVIDER_AVAILABILITY_FORBIDDEN: {
    message: "Provider availability management access is not available",
    statusCode: 403,
  },
  PROVIDER_AVAILABILITY_PROVIDER_STATE_INVALID: {
    message: "Provider is not approved",
    statusCode: 409,
  },
  PROVIDER_AVAILABILITY_VALIDATION_FAILED: {
    message: "Request validation failed",
    statusCode: 400,
  },
  PROVIDER_AVAILABILITY_COVERAGE_INVALID: {
    message: "Coverage selection is invalid",
    statusCode: 422,
  },
  PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH: {
    message: "Coverage selection is outside the Provider's own country",
    statusCode: 422,
  },
  PROVIDER_AVAILABILITY_SCHEDULE_INVALID: {
    message: "Provider schedule configuration is invalid",
    statusCode: 422,
  },
  PROVIDER_AVAILABILITY_PAUSE_INVALID: {
    message: "Provider temporary pause input is invalid",
    statusCode: 422,
  },
  PROVIDER_AVAILABILITY_PAUSE_CONFLICT: {
    message: "Provider already has an unresolved temporary pause",
    statusCode: 409,
  },
  PROVIDER_AVAILABILITY_VERSION_CONFLICT: {
    message: "Provider availability configuration changed concurrently",
    statusCode: 409,
  },
  PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT: {
    message: "Idempotency key was already used with different request input",
    statusCode: 409,
  },
  PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS: {
    message: "A prior identical request has not completed yet",
    statusCode: 409,
  },
  PROVIDER_AVAILABILITY_DEPENDENCY_FAILED: {
    message: "A required availability dependency failed",
    statusCode: 502,
  },
};

export class ProviderAvailabilityError extends Error {
  readonly code: ProviderAvailabilityErrorCode;
  readonly httpStatus: number;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: ProviderAvailabilityErrorCode,
    message?: string,
    options?: { readonly details?: Readonly<Record<string, unknown>> },
  ) {
    const definition = DEFINITIONS[code];
    super(message ?? definition.message);
    this.name = "ProviderAvailabilityError";
    this.code = code;
    this.httpStatus = definition.statusCode;
    this.details = options?.details;
  }
}

export function rethrowProviderAvailabilityAsAppError(error: unknown): never {
  if (error instanceof ProviderAvailabilityError) {
    throw new AppError({
      code: error.code,
      message: error.message,
      statusCode: error.httpStatus,
      expose: true,
      ...(error.details === undefined ? {} : { details: { ...error.details } }),
    });
  }
  throw error;
}
