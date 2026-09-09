import { LocalityError } from "../locality.types.js";

const SERIALIZATION_PRISMA_CODES = new Set(["P2034"]);
const TRANSACTION_CLOSED_PRISMA_CODES = new Set(["P2028"]);
const SERIALIZATION_SQL_STATES = new Set(["40001", "40P01"]);
const UNIQUE_PRISMA_CODES = new Set(["P2002"]);
const FOREIGN_KEY_PRISMA_CODES = new Set(["P2003"]);
const UNIQUE_SQL_STATES = new Set(["23505"]);
const FOREIGN_KEY_SQL_STATES = new Set(["23503"]);
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

function collectHints(error: Readonly<Record<string, unknown>>): string {
  const parts: string[] = [];
  const meta = error["meta"];
  if (typeof meta === "object" && meta !== null) {
    const metaRecord = meta as Readonly<Record<string, unknown>>;
    for (const key of ["target", "constraint", "message", "field_name", "modelName"]) {
      const value = metaRecord[key];
      if (typeof value === "string") {
        parts.push(value);
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === "string") parts.push(entry);
        }
      }
    }
  }
  const message = error["message"];
  if (typeof message === "string") parts.push(message);
  return parts.join(" ").toLowerCase();
}

function hintsInclude(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

export function localitySerializationConflictError(): LocalityError {
  return new LocalityError("LOCALITY_VERSION_CONFLICT", undefined, {
    details: { reason: "SERIALIZATION_FAILURE", retryable: true },
  });
}

export function isLocalitySerializationFailure(error: unknown): boolean {
  if (
    error instanceof LocalityError &&
    error.details?.["reason"] === "SERIALIZATION_FAILURE" &&
    error.details["retryable"] === true
  ) {
    return true;
  }
  const record = asRecord(error);
  if (record === null) return false;
  const code = readPrismaCode(record);
  if (code !== null && SERIALIZATION_PRISMA_CODES.has(code)) return true;
  const sqlState = readRawSqlState(record);
  if (sqlState !== null && SERIALIZATION_SQL_STATES.has(sqlState)) return true;
  return (
    code !== null &&
    TRANSACTION_CLOSED_PRISMA_CODES.has(code) &&
    hintsInclude(collectHints(record), SERIALIZATION_HINTS)
  );
}

/** Map locality persistence constraints to stable domain errors. */
export function mapPrismaLocalityPersistenceError(
  error: unknown,
): LocalityError | null {
  if (error instanceof LocalityError) return error;
  const record = asRecord(error);
  if (record === null) return null;

  const code = readPrismaCode(record);
  const sqlState = readRawSqlState(record);
  if (
    (code !== null && UNIQUE_PRISMA_CODES.has(code)) ||
    (sqlState !== null && UNIQUE_SQL_STATES.has(sqlState))
  ) {
    return new LocalityError("LOCALITY_ALREADY_EXISTS", undefined, {
      details: { reason: "UNIQUE_CONSTRAINT_CONFLICT" },
      cause: error,
    });
  }
  if (
    (code !== null && FOREIGN_KEY_PRISMA_CODES.has(code)) ||
    (sqlState !== null && FOREIGN_KEY_SQL_STATES.has(sqlState))
  ) {
    return new LocalityError("LOCALITY_DEPENDENCY_FAILED", undefined, {
      details: { reason: "FOREIGN_KEY_VIOLATION" },
      cause: error,
    });
  }
  return null;
}
