/**
 * Stable Catalog error codes and constructors.
 * Safe for HTTP mapping and structured logs; never embed localized content,
 * storage keys, signed URLs, or raw Prisma payloads.
 */

import { AppError } from "#shared/errors/app-error";

export type CatalogErrorCode =
  | "CATALOG_VALIDATION_FAILED"
  | "CATALOG_NOT_FOUND"
  | "CATALOG_FORBIDDEN"
  | "CATALOG_VERSION_CONFLICT"
  | "CATALOG_IDEMPOTENCY_CONFLICT"
  | "CATALOG_CODE_CONFLICT"
  | "CATALOG_ACTIVATION_INCOMPLETE"
  | "CATALOG_CONFIGURATION_INVALID"
  | "CATALOG_ORDER_INVALID"
  | "CATALOG_COUNTRY_UNAVAILABLE"
  | "CATALOG_MEDIA_INVALID"
  | "CATALOG_MEDIA_UNAVAILABLE"
  | "CATALOG_DEPENDENCY_FAILED";

export class CatalogError extends Error {
  readonly code: CatalogErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly httpStatus: number;

  constructor(
    code: CatalogErrorCode,
    message: string,
    options?: {
      readonly httpStatus?: number;
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "CatalogError";
    this.code = code;
    this.details = options?.details;
    this.httpStatus = options?.httpStatus ?? defaultHttpStatus(code);
  }
}

/** Runtime guard for approved public-contract consumers. */
export function isCatalogError(error: unknown): error is CatalogError {
  return error instanceof CatalogError;
}

function defaultHttpStatus(code: CatalogErrorCode): number {
  switch (code) {
    case "CATALOG_NOT_FOUND":
      return 404;
    case "CATALOG_FORBIDDEN":
      return 403;
    case "CATALOG_VERSION_CONFLICT":
    case "CATALOG_IDEMPOTENCY_CONFLICT":
    case "CATALOG_CODE_CONFLICT":
      return 409;
    case "CATALOG_MEDIA_UNAVAILABLE":
      return 503;
    case "CATALOG_DEPENDENCY_FAILED":
      return 502;
    default:
      return 400;
  }
}

/**
 * Map a Catalog domain error into the shared HTTP AppError envelope.
 */
export function catalogErrorToAppError(error: CatalogError): AppError {
  return new AppError({
    code: error.code,
    message: error.message,
    statusCode: error.httpStatus,
    expose: true,
    ...(error.details === undefined ? {} : { details: { ...error.details } }),
  });
}

/**
 * Forward CatalogError as AppError; leave other errors untouched for next().
 */
export function rethrowAsAppError(error: unknown): never {
  if (error instanceof CatalogError) {
    throw catalogErrorToAppError(error);
  }
  throw error;
}
