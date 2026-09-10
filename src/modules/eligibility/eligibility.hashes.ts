/**
 * Deterministic Eligibility hashes (R1-P11 / DEC-081, DEC-084).
 *
 * SHA-256 over UTF-8 canonical JSON (sorted keys, defined array order,
 * no undefined, UTC timestamps, canonical decimals).
 */

import { createHash } from "node:crypto";

import type {
  DiscoveryMetadata,
  EligibilityEvidenceSnapshot,
  EvaluationMetadata,
  EvaluationOutcomes,
  EvaluateEligibilityRequest,
  ProviderSummary,
  TeamResult,
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
 * Frozen resultHash projection — excludes requestHash, evidenceHash,
 * resultHash, evaluationId, trace, and persistence timestamps (DEC-081).
 */
export type EligibilityResultHashInput = {
  readonly evaluationOutcomes: EvaluationOutcomes;
  readonly eligibleProviders: readonly ProviderSummary[];
  readonly eligibleTeams: readonly TeamResult[];
  readonly excludedProviders: readonly ProviderSummary[];
  readonly excludedTeams: readonly TeamResult[];
  readonly metadata: {
    readonly contractVersion: string;
    readonly engineVersion: string;
    readonly ruleVersionId: string;
    readonly ruleChecksum: string;
    readonly evaluatedAt: string;
    readonly countryTimeZone: string;
    readonly calendarRuntimeVersion: string;
    readonly sourceVersions: Readonly<Record<string, string>>;
    readonly discovery: DiscoveryMetadata;
    readonly limits: EvaluationMetadata["limits"];
  };
};

/**
 * @desc Sort source-version keys for deterministic hashing / metadata.
 * @access Domain
 */
export function sortSourceVersions(
  versions: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(versions).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

/**
 * @desc Exact resultHash input — semantic diagnostic fields only.
 * @access Domain
 * @explanation Builds/hashes the frozen EligibilityResultHashInput projection.
 */
export function computeResultHash(input: EligibilityResultHashInput): string {
  const projection: EligibilityResultHashInput = {
    evaluationOutcomes: input.evaluationOutcomes,
    eligibleProviders: input.eligibleProviders,
    eligibleTeams: input.eligibleTeams,
    excludedProviders: input.excludedProviders,
    excludedTeams: input.excludedTeams,
    metadata: {
      contractVersion: input.metadata.contractVersion,
      engineVersion: input.metadata.engineVersion,
      ruleVersionId: input.metadata.ruleVersionId,
      ruleChecksum: input.metadata.ruleChecksum,
      evaluatedAt: input.metadata.evaluatedAt,
      countryTimeZone: input.metadata.countryTimeZone,
      calendarRuntimeVersion: input.metadata.calendarRuntimeVersion,
      sourceVersions: sortSourceVersions(input.metadata.sourceVersions),
      discovery: input.metadata.discovery,
      limits: input.metadata.limits,
    },
  };
  return eligibilitySha256(projection);
}
