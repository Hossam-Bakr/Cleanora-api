/**
 * Eligibility technical-error normalization (R1-P11 / DEC-071, DEC-081, DEC-084).
 *
 * Classifies retryable conflicts from structural shapes and Prisma/SQLSTATE
 * codes without requiring EligibilityError instanceof for detection.
 */

import { EligibilityError } from "./eligibility.errors.js";

const RETRYABLE_PRISMA_CODES = new Set(["P2028", "P2034"]);
const RETRYABLE_SQL_STATES = new Set(["40001", "40P01"]);

function asRecord(error: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  return error as Readonly<Record<string, unknown>>;
}

function readCode(error: Readonly<Record<string, unknown>>): string | null {
  const code = error["code"];
  return typeof code === "string" ? code : null;
}

function readSqlState(error: Readonly<Record<string, unknown>>): string | null {
  const directCause = error["cause"];
  if (typeof directCause === "object" && directCause !== null) {
    const causeRecord = directCause as Readonly<Record<string, unknown>>;
    const originalCode = causeRecord["originalCode"];
    if (typeof originalCode === "string") return originalCode;
    const causeCode = causeRecord["code"];
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
  const cause = (driverAdapterError as Readonly<Record<string, unknown>>)[
    "cause"
  ];
  if (typeof cause !== "object" || cause === null) return null;
  const originalCode = (cause as Readonly<Record<string, unknown>>)[
    "originalCode"
  ];
  return typeof originalCode === "string" ? originalCode : null;
}

/**
 * @desc True when an error is a retryable serialization / snapshot conflict.
 * @access Application
 * @explanation Accepts EligibilityError CONFLICT, structural `{code:"CONFLICT"}`
 * (Providers pricing), Prisma P2028/P2034, and SQLSTATE 40001/40P01.
 */
export function isRetryableConflictError(error: unknown): boolean {
  if (error instanceof EligibilityError) {
    return (
      error.code === "CONFLICT" ||
      error.code === "TRANSACTION_CONFLICT_EXHAUSTED"
    );
  }
  const record = asRecord(error);
  if (record === null) return false;
  const code = readCode(record);
  if (code === "CONFLICT") return true;
  if (code !== null && RETRYABLE_PRISMA_CODES.has(code)) return true;
  const sqlState = readSqlState(record);
  return sqlState !== null && RETRYABLE_SQL_STATES.has(sqlState);
}

/**
 * @desc Map a caught error to a typed EligibilityError for the public API.
 * @access Application
 */
export function normalizeEligibilityTechnicalError(
  error: unknown,
): EligibilityError {
  if (error instanceof EligibilityError) {
    return error;
  }
  if (isRetryableConflictError(error)) {
    return new EligibilityError("CONFLICT", {
      details: { reason: "TRANSACTION_CONTENTION" },
      cause: error,
    });
  }
  const record = asRecord(error);
  const code = record === null ? null : readCode(record);
  if (code === "INVALID_DEPENDENCY_DTO") {
    return new EligibilityError("INVALID_DEPENDENCY_DTO", { cause: error });
  }
  if (
    code === "DEPENDENCY_FAILURE" ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name: unknown }).name === "PrismaClientKnownRequestError")
  ) {
    return new EligibilityError("DEPENDENCY_FAILURE", { cause: error });
  }
  if (
    error instanceof Error &&
    /dependency|reader|timeout|ECONNREFUSED|unavailable/i.test(error.message)
  ) {
    return new EligibilityError("DEPENDENCY_FAILURE", { cause: error });
  }
  return new EligibilityError("DEPENDENCY_FAILURE", { cause: error });
}

/**
 * @desc Normalize persistence failures — preserve retryable conflicts.
 * @access Application
 */
export function normalizeEligibilityPersistenceError(
  error: unknown,
): EligibilityError {
  if (error instanceof EligibilityError) {
    return error;
  }
  if (isRetryableConflictError(error)) {
    return new EligibilityError("CONFLICT", {
      details: { reason: "TRANSACTION_CONTENTION" },
      cause: error,
    });
  }
  return new EligibilityError("PERSISTENCE_FAILED", { cause: error });
}
