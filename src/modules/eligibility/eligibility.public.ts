/**
 * Eligibility public contract (R1-P11).
 *
 * Matches `specs/R1-P11-eligibility-engine-v1/contracts/eligibility-public-contract.md`.
 * Runtime service factory is re-exported for composition; no HTTP adapters.
 */

/** Opaque handle owned by the composition/UoW layer. Eligibility never
 *  inspects Prisma internals through this type. */
export type EligibilityTransactionContext = unknown;

export type CrewPreference = "all_male" | "all_female" | "any";

export type EligibilityRuleId =
  | "CATALOG_APPLICABILITY"
  | "PROVIDER_APPROVAL_VERIFICATION_LIVE"
  | "OFFERING_PRICE_USABILITY"
  | "TEXTUAL_COVERAGE"
  | "PROVIDER_SCHEDULE_PAUSE"
  | "COMPLETE_TEAM_VALIDITY_AVAILABILITY"
  | "CREW_PREFERENCE"
  | "CAPACITY_AFTER_CREW_FILTER"
  | "PERFORMANCE_GATE";

export type RuleOutcomeStatus =
  | "PASS"
  | "FAIL"
  | "NOT_APPLICABLE"
  | "NOT_EVALUATED";

export type EligibilityReasonCode =
  | "SERVICE_NOT_AVAILABLE_IN_COUNTRY"
  | "SERVICE_INACTIVE_OR_UNKNOWN"
  | "PROVIDER_NOT_APPROVED"
  | "PROVIDER_NOT_LIVE"
  | "PROVIDER_SUSPENDED"
  | "VERIFICATION_NOT_SATISFIED"
  | "OFFERING_OR_PRICE_UNAVAILABLE"
  | "REQUESTED_INTERVAL_TOO_SHORT"
  | "CAPACITY_RULE_MISSING"
  | "COVERAGE_MISMATCH"
  | "PROVIDER_CLOSED_OR_OUTSIDE_HOURS"
  | "PROVIDER_PAUSED"
  | "NO_VALID_COMPLETE_TEAM"
  | "TEAM_STRUCTURALLY_INVALID"
  | "TEAM_MEMBERS_UNAVAILABLE"
  | "CREW_PREFERENCE_MISMATCH"
  | "INSUFFICIENT_CAPACITY_AFTER_CREW_FILTER"
  | "PERFORMANCE_GATE_FAILED"
  | "PERFORMANCE_EVIDENCE_MISSING"
  | "PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES"
  | "PERFORMANCE_EVIDENCE_STALE"
  | "NOT_IN_DISCOVERY_SCOPE";

/** Shared browse-shaped fields. IDs only — no locale, no geo. */
export interface EligibilityRequestBase {
  readonly serviceId: string;
  readonly countryId: string;
  readonly cityId: string;
  readonly districtId?: string;
  readonly startsAt: string; // Instant UTC ISO-8601
  readonly endsAt: string; // Instant UTC ISO-8601; half-open [startsAt, endsAt)
  readonly crewPreference: CrewPreference;
  readonly requiredTeamUnits: number; // integer 1–50
}

/** Normal discovery — P10 textual-area candidate lookup. */
export interface DiscoveryRequest extends EligibilityRequestBase {
  readonly mode: "discovery";
}

/**
 * Explicit Provider-ID set. IDs are validated, deduplicated, and canonically
 * sorted before evaluation. Length 1–500 after dedupe.
 */
export interface ExplicitRequest extends EligibilityRequestBase {
  readonly mode: "explicit";
  readonly providerIds: readonly string[];
}

export type EvaluateEligibilityRequest = DiscoveryRequest | ExplicitRequest;

/**
 * Browse facade input. Same shape as discovery — `providerIds` is **forbidden**.
 * Callers that need explicit IDs must use `evaluateEligibility` with
 * `ExplicitRequest`, never the Browse facade.
 */
export interface BrowseCandidatesRequest extends EligibilityRequestBase {
  readonly mode?: "discovery"; // default discovery; explicit mode rejected
}

export interface RuleOutcome {
  readonly ruleId: EligibilityRuleId;
  readonly status: RuleOutcomeStatus;
  /** Present when status is FAIL or informational performance NOT_EVALUATED. */
  readonly reasons: readonly EligibilityReasonCode[];
  /** When status is NOT_EVALUATED because a factual prerequisite failed. */
  readonly dependencyRuleId?: EligibilityRuleId;
}

export interface SortingFacts {
  readonly priceAmount: string; // canonical decimal string
  readonly minimumChargeAmount: string; // canonical decimal string
  readonly currencyCode: string;
  readonly priceUnitId: string;
  readonly estimatedDurationMinutes: number;
  readonly matchingCapacityUnits: number;
  /** Present only when valid performance facts were evaluated and allowlisted. */
  readonly performanceMetricKey?: string;
  readonly performanceValue?: string; // canonical decimal string
}

export interface ProviderSummary {
  readonly providerId: string;
  readonly eligible: boolean;
  readonly ruleOutcomes: readonly RuleOutcome[];
  /** Exclusion reasons only (informational performance codes excluded). */
  readonly reasons: readonly EligibilityReasonCode[];
  readonly sortingFacts: SortingFacts | null;
  /** Count of Teams that individually qualify AND whose Provider qualifies. */
  readonly qualifyingTeamCount: number;
}

export interface TeamResult {
  readonly providerId: string;
  readonly teamId: string;
  readonly eligible: boolean;
  readonly ruleOutcomes: readonly RuleOutcome[];
  readonly reasons: readonly EligibilityReasonCode[];
  readonly sortingFacts: SortingFacts | null;
}

export interface DiscoveryMetadata {
  readonly mode: "discovery" | "explicit";
  readonly countryId: string;
  readonly cityId: string;
  readonly districtId: string | null;
  readonly discoveredProviderCount: number;
  readonly evaluatedProviderCount: number;
  readonly teamResultCount: number;
  readonly complete: boolean;
}

/**
 * Evaluation-level rule outcomes (at least Catalog). Required even when zero
 * Providers are discovered so unavailable service ≠ empty-supply of an available
 * service (DEC-084).
 */
export interface EvaluationOutcomes {
  readonly catalog: RuleOutcome;
}

export interface EvaluationMetadata {
  readonly contractVersion: string;
  readonly engineVersion: string;
  readonly ruleVersionId: string;
  readonly ruleChecksum: string;
  readonly requestHash: string;
  readonly evidenceHash: string;
  readonly resultHash: string;
  readonly evaluatedAt: string; // Instant UTC — semantic
  readonly countryTimeZone: string;
  readonly calendarRuntimeVersion: string;
  readonly sourceVersions: Readonly<Record<string, string>>;
  readonly discovery: DiscoveryMetadata;
  readonly limits: {
    readonly maxProviders: 500;
    readonly maxTeamResults: 5000;
  };
}

export interface DiagnosticResult {
  readonly evaluationId: string; // operational; outside semantic equality
  readonly evaluationOutcomes: EvaluationOutcomes;
  readonly eligibleProviders: readonly ProviderSummary[];
  readonly eligibleTeams: readonly TeamResult[];
  readonly excludedProviders: readonly ProviderSummary[];
  readonly excludedTeams: readonly TeamResult[];
  readonly metadata: EvaluationMetadata;
}

export interface BrowseSafeCandidate {
  readonly providerId: string;
  readonly teamId: string;
  readonly sortingFacts: SortingFacts;
}

export interface BrowseSafeProjection {
  readonly candidates: readonly BrowseSafeCandidate[];
  readonly metadata: Pick<
    EvaluationMetadata,
    | "contractVersion"
    | "engineVersion"
    | "ruleVersionId"
    | "requestHash"
    | "evidenceHash"
    | "resultHash"
    | "evaluatedAt"
    | "countryTimeZone"
    | "discovery"
  >;
}

/** Production options — no caller-supplied asOf (DEC-084). */
export interface PurgeOptions {
  /**
   * Integer 1–500 inclusive. Omitted ⇒ 100.
   * Values outside 1–500 (including 0, negative, non-integer) → reject
   * VALIDATION_FAILED. Do not clamp.
   */
  readonly batchSize?: number;
}

export interface PurgeResult {
  readonly deletedEvaluations: number;
  readonly deletedCandidateResults: number;
  readonly moreRemaining: boolean;
  /** Fixed cutoff used for this invocation (expiresAt < cutoff). */
  readonly cutoff: string;
}

export type EligibilityErrorCode =
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_GEO_INPUT"
  | "RULE_VERSION_UNAVAILABLE"
  | "RULE_VERSION_INVALID"
  | "DEPENDENCY_FAILURE"
  | "INVALID_DEPENDENCY_DTO"
  | "EVALUATION_LIMIT_EXCEEDED"
  | "TRANSACTION_CONFLICT_EXHAUSTED"
  | "PERSISTENCE_FAILED"
  | "CONFLICT";

/**
 * Public error **shape** only (DEC-084). T007 declares this interface —
 * not a runtime class with constructor. A later Batch may implement a class
 * that satisfies this shape.
 */
export interface EligibilityError extends Error {
  readonly code: EligibilityErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Typed Team aggregate inside evidence — no Worker IDs. */
export interface EligibilityEvidenceTeamFacts {
  readonly teamId: string;
  readonly structurallyValid: boolean;
  readonly membersAvailableForWholeInterval: boolean;
  readonly cleanerGenderCounts: {
    readonly male: number;
    readonly female: number;
    readonly otherOrUnspecified: number;
  };
  readonly escortFacts: {
    readonly escortRequired: boolean;
    readonly escortPresentAndValid: boolean;
    readonly escortsAvailableForWholeInterval: boolean;
  };
}

/** Typed replay evidence — no Worker IDs / raw member arrays (DEC-084). */
export interface EligibilityEvidenceSnapshot {
  readonly normalizedRequest: {
    readonly mode: "discovery" | "explicit";
    readonly serviceId: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId: string | null; // omitted optional → null in snapshot
    readonly startsAt: string;
    readonly endsAt: string;
    readonly crewPreference: CrewPreference;
    readonly requiredTeamUnits: number;
    /** Discovery → null; explicit → canonically sorted unique IDs. */
    readonly providerIds: readonly string[] | null;
  };
  readonly evaluatedAt: string;
  readonly pinnedRule: {
    readonly ruleVersionId: string;
    readonly contentChecksum: string;
    readonly schemaVersion: string;
    readonly engineCompatibility: string;
    readonly versionLabel: string;
  };
  readonly countryLocality: {
    readonly countryCode: string;
    readonly countryTimeZone: string;
    readonly cityId: string;
    readonly districtId: string | null;
    readonly ancestryVersion: string | null;
  };
  readonly evaluationOutcomes: EvaluationOutcomes;
  /** Canonically ordered by providerId. */
  readonly providers: readonly {
    readonly providerId: string;
    readonly lifecycle:
      | { readonly status: "MISSING" }
      | {
          readonly status: "PRESENT";
          readonly approved: boolean;
          readonly live: boolean;
          readonly suspended: boolean;
          readonly verificationSatisfiedOrNotRequired: boolean;
          readonly aggregateVersion: string;
        };
    readonly pricing:
      | {
          readonly status: "AVAILABLE";
          readonly priceAmount: string;
          readonly minimumChargeAmount: string;
          readonly currencyCode: string;
          readonly priceUnitId: string;
          readonly estimatedDurationMinutes: number;
          readonly sourceVersion: string;
        }
      | {
          readonly status: "UNAVAILABLE";
          readonly reason: string;
          readonly sourceVersion: string | null;
        };
    readonly availability:
      | {
          readonly status: "MISSING_CONFIGURATION";
          readonly missingConfiguration: readonly (
            | "COVERAGE"
            | "PROVIDER_SCHEDULE"
            | "CAPACITY_RULE"
          )[];
          readonly coverageMatch: boolean;
          readonly providerScheduleAvailable: boolean;
          readonly paused: boolean;
          readonly suspended: boolean;
          readonly simultaneousTeamLimit: number | null;
          readonly teams: readonly EligibilityEvidenceTeamFacts[];
        }
      | {
          readonly status: "AVAILABLE_FACTS";
          readonly coverageMatch: boolean;
          readonly providerScheduleAvailable: boolean;
          readonly paused: boolean;
          readonly suspended: boolean;
          readonly simultaneousTeamLimit: number;
          readonly teams: readonly EligibilityEvidenceTeamFacts[]; // ordered by teamId
        }
      | {
          readonly status: "OVERFLOW";
          readonly acceptedTeams: readonly EligibilityEvidenceTeamFacts[];
        };
    readonly performance:
      | { readonly status: "NOT_APPLICABLE" }
      | { readonly status: "MISSING" }
      | {
          readonly status: "OK";
          readonly metricKey: string;
          readonly policyVersionId: string;
          readonly value: string;
          readonly sampleCount: number;
          readonly observedAt: string;
        };
  }[];
  readonly engineCalendar: {
    readonly engineVersion: string;
    readonly calendarRuntimeVersion: string;
    readonly contractVersion: string;
  };
  readonly sourceVersions: Readonly<Record<string, string>>;
}

/**
 * In-process Eligibility application surface (DEC-070). Composition constructs
 * the concrete service via `createEligibilityApplicationService`.
 */
export interface EligibilityApplicationService {
  evaluateEligibility(
    input: EvaluateEligibilityRequest,
  ): Promise<DiagnosticResult>;

  getStandardBrowseCandidates(
    input: BrowseCandidatesRequest,
  ): Promise<BrowseSafeProjection>;

  purgeExpiredEvaluations(options?: PurgeOptions): Promise<PurgeResult>;
}

/** Frozen contract name from eligibility-public-contract.md (alias). */
export type EligibilityPublicApi = EligibilityApplicationService;

export const ELIGIBILITY_PUBLIC_CONTRACT = {
  contractVersion: "eligibility.public.v1",
  module: "eligibility",
} as const;

export {
  createEligibilityApplicationService,
  mapDiagnosticToBrowseSafeProjection,
  validateBrowseCandidatesRequest,
  type EligibilityApplicationServiceDependencies,
  type EligibilityClock,
} from "./eligibility.service.js";

/** Runtime guard exposed for approved cross-module error mapping. */
export { isEligibilityError } from "./eligibility.errors.js";

