/**
 * Deterministic Eligibility hashes (R1-P11 / DEC-081, DEC-084).
 *
 * SHA-256 over UTF-8 canonical JSON (sorted keys, defined array order,
 * no undefined, UTC timestamps, canonical decimals).
 */

import { createHash } from "node:crypto";

import type {
  DiagnosticResult,
  EligibilityEvidenceSnapshot,
  EvaluateEligibilityRequest,
} from "./eligibility.public.js";

/**
 * @desc Canonical JSON for Eligibility checksums/hashes (DEC-081).
 * @access Domain
 */
export function eligibilityCanonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error("Eligibility canonical JSON forbids undefined");
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => eligibilityCanonicalJson(entry)).join(",")}]`;
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${eligibilityCanonicalJson(entry)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * @desc SHA-256 hex digest of canonical JSON.
 * @access Domain
 */
export function eligibilitySha256(value: unknown): string {
  return createHash("sha256")
    .update(eligibilityCanonicalJson(value), "utf8")
    .digest("hex");
}

/**
 * @desc Normalize request for hashing / evidence (optional district → null).
 * @access Domain
 */
export function normalizeEligibilityRequest(
  input: EvaluateEligibilityRequest,
): EligibilityEvidenceSnapshot["normalizedRequest"] {
  const providerIds =
    input.mode === "explicit"
      ? [...new Set(input.providerIds)].sort((left, right) =>
          left.localeCompare(right),
        )
      : null;
  return {
    mode: input.mode,
    serviceId: input.serviceId,
    countryId: input.countryId,
    cityId: input.cityId,
    districtId: input.districtId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    crewPreference: input.crewPreference,
    requiredTeamUnits: input.requiredTeamUnits,
    providerIds,
  };
}

/**
 * @desc Exact requestHash input (normalized request only).
 * @access Domain
 */
export function computeRequestHash(
  normalized: EligibilityEvidenceSnapshot["normalizedRequest"],
): string {
  return eligibilitySha256(normalized);
}

/**
 * @desc Exact evidenceHash input (typed evidence snapshot).
 * @access Domain
 */
export function computeEvidenceHash(
  evidence: EligibilityEvidenceSnapshot,
): string {
  return eligibilitySha256(evidence);
}

/**
 * @desc Exact resultHash input — semantic diagnostic fields only.
 * @access Domain
 * @explanation Excludes evaluationId and persistence timestamps (DEC-081).
 */
export function computeResultHash(
  result: Omit<DiagnosticResult, "evaluationId">,
): string {
  return eligibilitySha256(result);
}
