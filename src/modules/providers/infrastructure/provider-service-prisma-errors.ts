/**
 * Maps Prisma/PostgreSQL persistence failures to stable Provider Service errors.
 * Serialization failures carry retryable details for bounded service-layer retry.
 */

import { ProviderServiceError } from "../domain/provider-service.errors.js";

const SERIALIZATION_PRISMA_CODES = new Set(["P2034", "P2028"]);
const FK_PRISMA_CODES = new Set(["P2003"]);
const CHECK_PRISMA_CODES = new Set(["P2004"]);
const UNIQUE_PRISMA_CODES = new Set(["P2002"]);
const NOT_FOUND_PRISMA_CODES = new Set(["P2025"]);

const SERIALIZATION_SQL_STATES = new Set(["40001", "40P01"]);
const FK_SQL_STATES = new Set(["23503"]);
const UNIQUE_SQL_STATES = new Set(["23505"]);
const CHECK_SQL_STATES = new Set(["23514"]);

const OFFERING_UNIQUE_HINTS = [
  "provider_id",
  "catalog_service_id",
  "providerId",
  "catalogServiceId",
  "provider_services_provider_catalog_service_key",
  "provider_services_provider_id_catalog_service_id_key",
] as const;

const PENDING_UNIQUE_HINTS = [
  "pending",
  "provider_service_prices_one_pending",
  "provider_service_prices_pending",
] as const;

const EFFECTIVE_UNIQUE_HINTS = [
  "effective",
  "provider_service_prices_one_effective",
  "provider_service_prices_effective",
] as const;

const RECEIPT_UNIQUE_HINTS = [
  "scope_key",
  "idempotency_key",
  "scopeKey",
  "idempotencyKey",
  "provider_service_price_history_scope",
  "provider_service_status_history_scope",
] as const;

const OPERATION_KEY_HINTS = ["operation_key", "operationKey"] as const;

function asRecord(error: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  return error as Readonly<Record<string, unknown>>;
}

function readPrismaCode(error: Readonly<Record<string, unknown>>): string | null {
  const code = error["code"];
  return typeof code === "string" ? code : null;
}

function readRawSqlState(error: Readonly<Record<string, unknown>>): string | null {
  const directCause = error["cause"];
  if (typeof directCause === "object" && directCause !== null) {
    const directCauseRecord = directCause as Readonly<Record<string, unknown>>;
    const originalCode = directCauseRecord["originalCode"];
    if (typeof originalCode === "string") return originalCode;
    const causeCode = directCauseRecord["code"];
    if (typeof causeCode === "string") return causeCode;
  }
  const meta = error["meta"];
  if (typeof meta !== "object" || meta === null) return null;
  const metaRecord = meta as Readonly<Record<string, unknown>>;
  const direct = metaRecord["code"];
  if (typeof direct === "string") return direct;
  const driverAdapterError = metaRecord["driverAdapterError"];
  if (typeof driverAdapterError !== "object" || driverAdapterError === null) {
    return null;
  }
  const cause = (driverAdapterError as Readonly<Record<string, unknown>>)["cause"];
  if (typeof cause !== "object" || cause === null) return null;
  const originalCode = (cause as Readonly<Record<string, unknown>>)["originalCode"];
  return typeof originalCode === "string" ? originalCode : null;
}

function collectTargetHints(error: Readonly<Record<string, unknown>>): string {
  const parts: string[] = [];
  const meta = error["meta"];
  if (typeof meta === "object" && meta !== null) {
    const metaRecord = meta as Readonly<Record<string, unknown>>;
    const target = metaRecord["target"];
    if (typeof target === "string") {
      parts.push(target);
    } else if (Array.isArray(target)) {
      for (const entry of target) {
        if (typeof entry === "string") parts.push(entry);
      }
    }
    const constraint = metaRecord["constraint"];
    if (typeof constraint === "string") parts.push(constraint);
    const fieldName = metaRecord["field_name"];
    if (typeof fieldName === "string") parts.push(fieldName);
    const modelName = metaRecord["modelName"];
    if (typeof modelName === "string") parts.push(modelName);
  }
  const message = error["message"];
  if (typeof message === "string") parts.push(message);
  return parts.join(" ").toLowerCase();
}

function hintsInclude(
  haystack: string,
  needles: readonly string[],
): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

/**
 * @desc True when a persistence failure is a retryable serialization/snapshot race.
 * @access Infrastructure
 * @explanation Service-owned bounded retries use this without treating business
 * uniqueness conflicts as successful outcomes.
 */
export function isProviderServiceSerializationFailure(error: unknown): boolean {
  if (error instanceof ProviderServiceError) {
    return error.details?.["reason"] === "SERIALIZATION_FAILURE";
  }
  const record = asRecord(error);
  if (record === null) return false;
  const code = readPrismaCode(record);
  if (code !== null && SERIALIZATION_PRISMA_CODES.has(code)) return true;
  const sqlState = readRawSqlState(record);
  return sqlState !== null && SERIALIZATION_SQL_STATES.has(sqlState);
}

/**
 * @desc Stable error for compare-and-increment updates that affect zero rows.
 * @access Infrastructure
 */
export function providerServiceStaleVersionError(cause?: unknown): ProviderServiceError {
  return new ProviderServiceError("PROVIDER_SERVICE_VERSION_CONFLICT", undefined, {
    details: { reason: "STALE_VERSION" },
    cause,
  });
}

/**
 * @desc Map a Prisma/driver failure to a closed Provider Service error, or null.
 * @access Infrastructure
 * @explanation Unique races distinguish offering, pending/effective, and receipt
 * targets; serialization failures are marked retryable for the service layer.
 */
export function mapPrismaProviderServiceError(
  error: unknown,
): ProviderServiceError | null {
  if (error instanceof ProviderServiceError) {
    return error;
  }
  const record = asRecord(error);
  if (record === null) {
    return null;
  }

  const prismaCode = readPrismaCode(record);
  const sqlState = readRawSqlState(record);
  const targetHints = collectTargetHints(record);

  if (
    (prismaCode !== null && SERIALIZATION_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && SERIALIZATION_SQL_STATES.has(sqlState))
  ) {
    return new ProviderServiceError(
      "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
      undefined,
      {
        details: { reason: "SERIALIZATION_FAILURE", retryable: true },
        cause: error,
      },
    );
  }

  if (
    (prismaCode !== null && UNIQUE_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && UNIQUE_SQL_STATES.has(sqlState))
  ) {
    if (hintsInclude(targetHints, RECEIPT_UNIQUE_HINTS)) {
      return new ProviderServiceError(
        "PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT",
        undefined,
        {
          details: { reason: "RECEIPT_UNIQUE_RACE" },
          cause: error,
        },
      );
    }
    if (hintsInclude(targetHints, OPERATION_KEY_HINTS)) {
      return new ProviderServiceError(
        "PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT",
        undefined,
        {
          details: { reason: "OPERATION_KEY_UNIQUE_RACE" },
          cause: error,
        },
      );
    }
    if (
      hintsInclude(targetHints, PENDING_UNIQUE_HINTS) ||
      hintsInclude(targetHints, EFFECTIVE_UNIQUE_HINTS)
    ) {
      return new ProviderServiceError(
        "PROVIDER_SERVICE_VERSION_CONFLICT",
        undefined,
        {
          details: { reason: "PARTIAL_UNIQUE_PRICE_RACE" },
          cause: error,
        },
      );
    }
    if (hintsInclude(targetHints, OFFERING_UNIQUE_HINTS)) {
      return new ProviderServiceError(
        "PROVIDER_SERVICE_ALREADY_EXISTS",
        undefined,
        {
          details: { reason: "OFFERING_UNIQUE_CONFLICT" },
          cause: error,
        },
      );
    }
    return new ProviderServiceError(
      "PROVIDER_SERVICE_VERSION_CONFLICT",
      undefined,
      {
        details: { reason: "UNIQUE_CONSTRAINT_CONFLICT" },
        cause: error,
      },
    );
  }

  if (
    (prismaCode !== null && FK_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && FK_SQL_STATES.has(sqlState))
  ) {
    return new ProviderServiceError(
      "PROVIDER_SERVICE_DEPENDENCY_FAILED",
      undefined,
      {
        details: { reason: "FOREIGN_KEY_VIOLATION" },
        cause: error,
      },
    );
  }

  if (
    (prismaCode !== null && CHECK_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && CHECK_SQL_STATES.has(sqlState))
  ) {
    return new ProviderServiceError(
      "PROVIDER_SERVICE_PRICE_INVALID",
      undefined,
      {
        details: { reason: "CHECK_CONSTRAINT_VIOLATION" },
        cause: error,
      },
    );
  }

  if (prismaCode !== null && NOT_FOUND_PRISMA_CODES.has(prismaCode)) {
    return new ProviderServiceError(
      "PROVIDER_SERVICE_NOT_FOUND",
      undefined,
      {
        details: { reason: "RECORD_NOT_FOUND" },
        cause: error,
      },
    );
  }

  return null;
}
