import { WorkforcePolicyError } from "../domain/provider-workforce.policy.js";

const STATE_CONFLICT_CODES = new Set(["P2002", "P2003", "P2004", "P2028", "P2034"]);
const WORKFORCE_CONSTRAINT_SQL_STATES = new Set(["23503", "23505", "23514", "55000"]);

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
  const direct = (meta as Readonly<Record<string, unknown>>)["code"];
  if (typeof direct === "string") return direct;
  const driverAdapterError = (meta as Readonly<Record<string, unknown>>)["driverAdapterError"];
  if (typeof driverAdapterError !== "object" || driverAdapterError === null) return null;
  const cause = (driverAdapterError as Readonly<Record<string, unknown>>)["cause"];
  if (typeof cause !== "object" || cause === null) return null;
  const originalCode = (cause as Readonly<Record<string, unknown>>)["originalCode"];
  return typeof originalCode === "string" ? originalCode : null;
}

/** Maps persistence failures to the closed safe workforce error surface. */
export function mapPrismaWorkforceError(error: unknown): WorkforcePolicyError | null {
  if (error instanceof WorkforcePolicyError) return error;
  if (typeof error !== "object" || error === null) return null;
  const record = error as Readonly<Record<string, unknown>>;
  const code = record["code"];
  if (code === "P2025") return new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
  if (typeof code === "string" && STATE_CONFLICT_CODES.has(code)) {
    return new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  if (WORKFORCE_CONSTRAINT_SQL_STATES.has(readRawSqlState(record) ?? "")) {
    return new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
  }
  return null;
}
