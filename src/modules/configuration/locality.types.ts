/**
 * Configuration-owned locality (City/District) domain types and stable error
 * catalog. Staff-only management; Providers consumes only the narrow public
 * `CountryTimeZoneReader` — never these internal snapshot shapes.
 */

import { AppError } from "#shared/errors/app-error";

export interface CitySnapshot {
  readonly id: string;
  readonly countryId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DistrictSnapshot {
  readonly id: string;
  readonly cityId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type LocalityErrorCode =
  | "REQUEST_VALIDATION_FAILED"
  | "LOCALITY_FORBIDDEN"
  | "LOCALITY_COUNTRY_UNAVAILABLE"
  | "LOCALITY_CITY_NOT_FOUND"
  | "LOCALITY_DISTRICT_NOT_FOUND"
  | "LOCALITY_ALREADY_EXISTS"
  | "LOCALITY_VERSION_CONFLICT"
  | "LOCALITY_REASON_INVALID"
  | "LOCALITY_TIME_ZONE_INVALID"
  | "LOCALITY_TIME_ZONE_NOT_SET"
  | "LOCALITY_IDEMPOTENCY_CONFLICT"
  | "LOCALITY_COMMAND_IN_PROGRESS"
  | "LOCALITY_DEPENDENCY_FAILED";

const DEFINITIONS: Record<
  LocalityErrorCode,
  { readonly message: string; readonly statusCode: number }
> = {
  REQUEST_VALIDATION_FAILED: {
    message: "Request validation failed",
    statusCode: 400,
  },
  LOCALITY_FORBIDDEN: {
    message: "Locality management access is not available",
    statusCode: 403,
  },
  LOCALITY_COUNTRY_UNAVAILABLE: {
    message: "Country is unavailable",
    statusCode: 409,
  },
  LOCALITY_CITY_NOT_FOUND: {
    message: "City is not available",
    statusCode: 404,
  },
  LOCALITY_DISTRICT_NOT_FOUND: {
    message: "District is not available",
    statusCode: 404,
  },
  LOCALITY_ALREADY_EXISTS: {
    message: "Locality code or localized name already exists",
    statusCode: 409,
  },
  LOCALITY_VERSION_CONFLICT: {
    message: "Locality changed concurrently",
    statusCode: 409,
  },
  LOCALITY_REASON_INVALID: {
    message: "An approved privileged reason is required for this write",
    statusCode: 400,
  },
  LOCALITY_TIME_ZONE_INVALID: {
    message: "Time zone identifier is invalid",
    statusCode: 400,
  },
  LOCALITY_TIME_ZONE_NOT_SET: {
    message: "Country time zone is not configured",
    statusCode: 404,
  },
  LOCALITY_IDEMPOTENCY_CONFLICT: {
    message: "Idempotency key was already used with different request input",
    statusCode: 409,
  },
  LOCALITY_COMMAND_IN_PROGRESS: {
    message: "A prior identical request has not completed yet",
    statusCode: 409,
  },
  LOCALITY_DEPENDENCY_FAILED: {
    message: "A required locality dependency failed",
    statusCode: 502,
  },
};

export class LocalityError extends Error {
  readonly code: LocalityErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;
  readonly httpStatus: number;

  constructor(
    code: LocalityErrorCode,
    message?: string,
    options?: {
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    },
  ) {
    const definition = DEFINITIONS[code];
    super(message ?? definition.message, { cause: options?.cause });
    this.name = "LocalityError";
    this.code = code;
    this.details = options?.details;
    this.httpStatus = definition.statusCode;
  }
}

export function localityErrorToAppError(error: LocalityError): AppError {
  return new AppError({
    code: error.code,
    message: error.message,
    statusCode: error.httpStatus,
    expose: true,
    ...(error.details === undefined ? {} : { details: { ...error.details } }),
  });
}

export function rethrowLocalityAsAppError(error: unknown): never {
  if (error instanceof LocalityError) {
    throw localityErrorToAppError(error);
  }
  throw error;
}

export interface CityManagementDto {
  readonly id: string;
  readonly countryId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DistrictManagementDto {
  readonly id: string;
  readonly cityId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CountryTimeZoneDto {
  readonly countryId: string;
  readonly countryCode: string;
  readonly timeZone: string;
  readonly version: number;
}

export function toCityManagementDto(city: CitySnapshot): CityManagementDto {
  return {
    id: city.id,
    countryId: city.countryId,
    code: city.code,
    nameAr: city.nameAr,
    nameEn: city.nameEn,
    isActive: city.isActive,
    version: city.version,
    createdAt: city.createdAt.toISOString(),
    updatedAt: city.updatedAt.toISOString(),
  };
}

export function toDistrictManagementDto(
  district: DistrictSnapshot,
): DistrictManagementDto {
  return {
    id: district.id,
    cityId: district.cityId,
    code: district.code,
    nameAr: district.nameAr,
    nameEn: district.nameEn,
    isActive: district.isActive,
    version: district.version,
    createdAt: district.createdAt.toISOString(),
    updatedAt: district.updatedAt.toISOString(),
  };
}
