/**
 * Deterministic R1-P11 Eligibility fixtures. Synthetic only — never production
 * credentials, tokens, or live Provider/Customer data. Disposable builders for
 * public-contract request shapes (Batch A / T004). Phase 11 disposable DB
 * guards for Batch B live constraint/seed proofs.
 */

import type {
  BrowseCandidatesRequest,
  DiscoveryRequest,
  ExplicitRequest,
} from "#modules/eligibility/eligibility.public";
import type {
  PerformanceEvidence,
  PerformanceEvidencePort,
  PerformanceEvidenceResult,
} from "#modules/eligibility/performance-evidence.port";

/** Approved disposable Phase 11 database name pattern (never production). */
const APPROVED_R1_P11_TARGET_PATTERN =
  /^cleanora_r1_p11(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/;

/**
 * @desc Require an explicitly named, phase-owned disposable Phase 11 URL.
 * @access Test helper
 * @explanation Never falls back to `DATABASE_URL` or another phase's target.
 */
export function requireR1P11ProofDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P11_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      "CLEANORA_R1_P11_DATABASE_URL is required for R1-P11 disposable proofs",
    );
  }
  let targetName: string;
  try {
    const url = new URL(value);
    targetName = decodeURIComponent(url.pathname.replace(/^\//u, ""));
  } catch {
    throw new Error("R1-P11 database URL is not a valid URL");
  }
  if (!APPROVED_R1_P11_TARGET_PATTERN.test(targetName)) {
    throw new Error(
      `Refusing R1-P11 database work against unapproved target "${targetName}"`,
    );
  }
  return value;
}

/** True only when an owner-approved disposable Phase 11 URL is explicitly present. */
export function hasExplicitR1P11TestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    requireR1P11ProofDatabaseUrl(env);
    return true;
  } catch {
    return false;
  }
}

/** Fixed synthetic IDs for Phase 11 unit/integration fixtures. */
export const R1_P11_IDS = {
  countryId: "00000000-0000-4000-8000-0000000000c1",
  cityId: "00000000-0000-4000-8000-0000000000c2",
  districtId: "00000000-0000-4000-8000-0000000000d1",
  serviceId: "00000000-0000-4000-8000-0000000000s1",
  providerId: "00000000-0000-4000-8000-0000000000p1",
  otherProviderId: "00000000-0000-4000-8000-0000000000p2",
  teamId: "00000000-0000-4000-8000-0000000000t1",
  evaluationId: "00000000-0000-4000-8000-0000000000e1",
  ruleVersionId: "eligibility_rule_r1_v1_eg",
} as const;

/** Fixed Instant UTC interval (2-hour half-open window). */
export const R1_P11_TIMES = {
  startsAt: "2026-09-15T08:00:00.000Z",
  endsAt: "2026-09-15T10:00:00.000Z",
  evaluatedAt: "2026-09-09T12:00:00.000Z",
} as const;

type DiscoveryOverrides = Partial<Omit<DiscoveryRequest, "mode">>;
type ExplicitOverrides = Partial<Omit<ExplicitRequest, "mode">>;
type BrowseOverrides = Partial<Omit<BrowseCandidatesRequest, "mode">>;

function baseRequestFields(
  overrides: DiscoveryOverrides | ExplicitOverrides | BrowseOverrides = {},
): Omit<DiscoveryRequest, "mode"> {
  return {
    serviceId: overrides.serviceId ?? R1_P11_IDS.serviceId,
    countryId: overrides.countryId ?? R1_P11_IDS.countryId,
    cityId: overrides.cityId ?? R1_P11_IDS.cityId,
    districtId: overrides.districtId ?? R1_P11_IDS.districtId,
    startsAt: overrides.startsAt ?? R1_P11_TIMES.startsAt,
    endsAt: overrides.endsAt ?? R1_P11_TIMES.endsAt,
    crewPreference: overrides.crewPreference ?? "any",
    requiredTeamUnits: overrides.requiredTeamUnits ?? 1,
  };
}

/**
 * @desc Build a synthetic discovery EvaluateEligibility request.
 * @access Test helper
 * @explanation Fixed UUIDs/ISO times only; no credentials or secrets.
 */
export function buildDiscoveryRequest(
  overrides: DiscoveryOverrides = {},
): DiscoveryRequest {
  return {
    mode: "discovery",
    ...baseRequestFields(overrides),
  };
}

/**
 * @desc Build a synthetic explicit-ID EvaluateEligibility request.
 * @access Test helper
 * @explanation Provider IDs are disposable fixtures, never live credentials.
 */
export function buildExplicitRequest(
  overrides: ExplicitOverrides = {},
): ExplicitRequest {
  return {
    mode: "explicit",
    ...baseRequestFields(overrides),
    providerIds:
      overrides.providerIds ??
      ([R1_P11_IDS.providerId, R1_P11_IDS.otherProviderId] as const),
  };
}

/**
 * @desc Build a synthetic Browse facade request (discovery-shaped).
 * @access Test helper
 * @explanation Omits providerIds; callers must not attach them for Browse.
 */
export function buildBrowseCandidatesRequest(
  overrides: BrowseOverrides = {},
): BrowseCandidatesRequest {
  return {
    mode: "discovery",
    ...baseRequestFields(overrides),
  };
}

/**
 * @desc Build synthetic performance evidence for enabled-gate tests.
 * @access Test helper
 */
export function buildPerformanceEvidence(
  overrides: Partial<PerformanceEvidence> = {},
): PerformanceEvidence {
  return {
    providerId: overrides.providerId ?? R1_P11_IDS.providerId,
    metricKey: overrides.metricKey ?? "completion_rate",
    policyVersionId: overrides.policyVersionId ?? R1_P11_IDS.ruleVersionId,
    value: overrides.value ?? "0.95",
    sampleCount: overrides.sampleCount ?? 25,
    observedAt: overrides.observedAt ?? "2026-09-09T10:00:00.000Z",
  };
}

/**
 * @desc Deterministic PerformanceEvidencePort double (OK | MISSING only).
 * @access Test helper
 * @explanation Records calls so disabled-gate tests can assert the port was
 * never invoked.
 */
export function createPerformanceEvidencePortDouble(options?: {
  readonly result?: PerformanceEvidenceResult;
}): PerformanceEvidencePort & {
  readonly calls: readonly {
    readonly providerId: string;
    readonly metricKey: string;
    readonly asOf: string;
    readonly policyVersionId: string;
  }[];
} {
  const calls: {
    providerId: string;
    metricKey: string;
    asOf: string;
    policyVersionId: string;
  }[] = [];
  const result: PerformanceEvidenceResult = options?.result ?? {
    status: "OK",
    evidence: buildPerformanceEvidence(),
  };
  return {
    get calls() {
      return calls;
    },
    async getEvidence(input) {
      calls.push({ ...input });
      return result;
    },
  };
}
