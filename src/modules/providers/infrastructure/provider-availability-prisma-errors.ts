/**
 * Maps Prisma/PostgreSQL persistence failures to stable Provider Availability
 * errors. Mirrors `provider-service-prisma-errors.ts`'s narrower rule set.
 */

import { ProviderAvailabilityError } from "../domain/provider-availability.errors.js";

const SERIALIZATION_PRISMA_CODES = new Set(["P2034"]);
const TRANSACTION_CLOSED_PRISMA_CODES = new Set(["P2028"]);
const UNIQUE_PRISMA_CODES = new Set(["P2002"]);
const FK_PRISMA_CODES = new Set(["P2003"]);
const CHECK_PRISMA_CODES = new Set(["P2004"]);
const SERIALIZATION_SQL_STATES = new Set(["40001", "40P01"]);
const UNIQUE_SQL_STATES = new Set(["23505"]);
const FK_SQL_STATES = new Set(["23503"]);
const CHECK_SQL_STATES = new Set(["23514"]);

const RECEIPT_UNIQUE_HINTS = [
  "scope_key",
  "idempotency_key",
  "provider_availability_commands_scope_idempotency_unique",
] as const;
const PAUSE_UNRESOLVED_UNIQUE_HINTS = [
  "provider_temporary_pauses_one_unresolved_per_provider",
  "one_unresolved_per_provider",
] as const;
const SERIALIZATION_HINTS = [
  "40001",
  "40P01",
  "could not serialize",
  "deadlock",
  "serialization",
  "write conflict",
  "concurrent update",
] as const;

function asRecord(error: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof error !== "object" || error === null) return null;
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
    if (typeof target === "string") parts.push(target);
    else if (Array.isArray(target)) {
      for (const entry of target) if (typeof entry === "string") parts.push(entry);
    }
    const constraint = metaRecord["constraint"];
    if (typeof constraint === "string") parts.push(constraint);
  }
  const message = error["message"];
  if (typeof message === "string") parts.push(message);
  return parts.join(" ").toLowerCase();
}

function hintsInclude(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function isMappedSerializationConflict(error: unknown): boolean {
  return (
    error instanceof ProviderAvailabilityError &&
    error.details?.["reason"] === "SERIALIZATION_FAILURE" &&
    error.details["retryable"] === true
  );
}

export function providerAvailabilitySerializationConflictError(): ProviderAvailabilityError {
  return new ProviderAvailabilityError(
    "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
    undefined,
    { details: { reason: "SERIALIZATION_FAILURE", retryable: true } },
  );
}

/** True when a persistence failure is a retryable serialization/snapshot race. */
export function isProviderAvailabilitySerializationFailure(
  error: unknown,
): boolean {
  if (isMappedSerializationConflict(error)) return true;
  const record = asRecord(error);
  if (record === null) return false;
  const code = readPrismaCode(record);
  if (code !== null && SERIALIZATION_PRISMA_CODES.has(code)) return true;
  const sqlState = readRawSqlState(record);
  if (sqlState !== null && SERIALIZATION_SQL_STATES.has(sqlState)) return true;
  return (
    code !== null &&
    TRANSACTION_CLOSED_PRISMA_CODES.has(code) &&
    hintsInclude(collectTargetHints(record), SERIALIZATION_HINTS)
  );
}

/** Map a Prisma/driver failure to a closed Provider Availability error, or null. */
export function mapPrismaProviderAvailabilityError(
  error: unknown,
): ProviderAvailabilityError | null {
  if (error instanceof ProviderAvailabilityError) return error;
  const record = asRecord(error);
  if (record === null) return null;

  const prismaCode = readPrismaCode(record);
  const sqlState = readRawSqlState(record);
  const targetHints = collectTargetHints(record);

  if (
    (prismaCode !== null && SERIALIZATION_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && SERIALIZATION_SQL_STATES.has(sqlState)) ||
    (prismaCode !== null &&
      TRANSACTION_CLOSED_PRISMA_CODES.has(prismaCode) &&
      hintsInclude(targetHints, SERIALIZATION_HINTS))
  ) {
    return providerAvailabilitySerializationConflictError();
  }

  if (
    (prismaCode !== null && UNIQUE_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && UNIQUE_SQL_STATES.has(sqlState))
  ) {
    if (hintsInclude(targetHints, RECEIPT_UNIQUE_HINTS)) {
      return new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
        undefined,
        { details: { reason: "RECEIPT_UNIQUE_RACE" } },
      );
    }
    if (hintsInclude(targetHints, PAUSE_UNRESOLVED_UNIQUE_HINTS)) {
      return new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_PAUSE_CONFLICT",
      );
    }
    return new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
      undefined,
      { details: { reason: "UNIQUE_CONSTRAINT_CONFLICT" } },
    );
  }

  if (
    (prismaCode !== null && FK_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && FK_SQL_STATES.has(sqlState))
  ) {
    return new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
      undefined,
      { details: { reason: "FOREIGN_KEY_VIOLATION" } },
    );
  }

  if (
    (prismaCode !== null && CHECK_PRISMA_CODES.has(prismaCode)) ||
    (sqlState !== null && CHECK_SQL_STATES.has(sqlState))
  ) {
    return new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
      undefined,
      { details: { reason: "CHECK_CONSTRAINT_VIOLATION" } },
    );
  }

  return null;
}
