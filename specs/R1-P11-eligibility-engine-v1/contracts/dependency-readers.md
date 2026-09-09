# Dependency Readers — Existing vs Proposed (P11)

Authority: DEC-066, DEC-073, DEC-079, DEC-081, DEC-084.

Eligibility consumes **public** seams only. Composition supplies
**transaction-bound factories** that accept an opaque transaction context.
Bound readers **must not** open nested or independent transactions.

```ts
/** Same opaque type as EligibilityTransactionContext. */
type Tx = unknown;
```

## Catalog / Configuration ID resolution chain

| Step | Input | Reader (actual method) | Output / null treatment |
|---|---|---|---|
| 1 | `countryId` | Configuration `createTransactionalActiveCountryReader` → `getActiveCountryById` | Active country facts including `countryCode` (seed expects `EG`) and IANA zone. Null / inactive → global `VALIDATION_FAILED`. |
| 2 | locality ids | Configuration transaction-bound locality / time-zone readers | Active ancestry; unknown/inactive ancestry → **global** `VALIDATION_FAILED`. |
| 3 | `serviceId` + `countryCode` | Catalog `createTransactionalCatalogDefinitionReaderFactory` → `getProviderOfferingReference({ serviceId, countryCode })` | Offering reference (service identity, code, country applicability). Null → Catalog business outcome (`SERVICE_INACTIVE_OR_UNKNOWN` or equivalent unavailable), **not** a hard error when the service id was well-formed. |
| 4 | service code + country code (when code path needed) | Same Catalog factory → `resolveSelectableProviderOffering({ serviceCode, countryCode })` | Selectable offering reference. Null → Catalog business `FAIL` (`SERVICE_NOT_AVAILABLE_IN_COUNTRY` / inactive-unknown as mapped). |

Eligibility never invents a locale for Catalog or Providers pricing.

## Transaction-bound factory pattern (required)

```ts
type TransactionalReaderFactory<TReader> = (tx: Tx) => TReader;
```

Composition constructs factories. Eligibility calls `factory(tx)` inside its
owned interactive transaction and uses only the returned bound reader for that
attempt.

## Catalog

### Reused unchanged (named methods)

| Method / factory | Status | Supplies |
|---|---|---|
| `createTransactionalCatalogDefinitionReaderFactory` | **Reuse** (exists) | Opaque-tx binding |
| Bound `getProviderOfferingReference({ serviceId, countryCode })` | **Reuse** | ID-based offering identity / applicability |
| Bound `resolveSelectableProviderOffering({ serviceCode, countryCode })` | **Reuse** | Code-based selectability |

Null from either offering method is an **expected business outcome** for the
Catalog rule (evaluation may complete with empty Providers). Reader outage,
invalid DTO, or DB failure rejects the whole evaluation.

**Ownership**: Catalog. No Catalog Prisma from Eligibility.

## Providers — locale-independent eligibility pricing projection

### Existing (insufficient alone)

- `ProviderServiceSnapshotReader.getSnapshotReadyFacts` requires
  `catalogServiceCode`, `countryCode`, and **`locale`**.

### New for P11 (required) — mutually exclusive states (DEC-084)

```ts
export type EligibilityPricingFacts =
  | {
      readonly status: "AVAILABLE";
      readonly providerId: string;
      readonly serviceId: string;
      readonly priceAmount: string;              // canonical decimal; non-null
      readonly minimumChargeAmount: string;      // canonical decimal; non-null
      readonly currencyCode: string;             // non-null
      readonly priceUnitId: string;              // non-null
      readonly estimatedDurationMinutes: number; // non-null positive integer
      readonly sourceVersion: string;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly providerId: string;
      readonly serviceId: string;
      /** Owning-module business reason; never CONFLICT. */
      /** Owning-module business unavailability only — no request-interval judgment. */
      readonly reason: "OFFERING_OR_PRICE_UNAVAILABLE";
      readonly sourceVersion: string | null;
    };

export interface EligibilityPricingReader {
  getEligibilityPricingFacts(input: {
    readonly providerId: string;
    readonly serviceId: string;
    readonly countryId: string;
  }): Promise<EligibilityPricingFacts>;
}

export type TransactionalEligibilityPricingReaderFactory =
  (tx: Tx) => EligibilityPricingReader;
```

- Reuses P09 **owned** selection/usability logic inside Providers.
- **Does not** invent a locale to call the localized snapshot API.
- **Does not** duplicate price selection inside Eligibility.
- `AVAILABLE` **must not** carry null money/unit/currency/duration, and **must
  not** coexist with an unavailable state.
- `UNAVAILABLE` maps only to owning-module offering/price unavailability
  (`OFFERING_OR_PRICE_UNAVAILABLE`). The pricing reader does **not** receive a
  requested interval and must **not** emit `REQUESTED_INTERVAL_TOO_SHORT`.
- Eligibility compares `estimatedDurationMinutes` from `AVAILABLE` facts against
  the requested UTC interval and emits `REQUESTED_INTERVAL_TOO_SHORT` when the
  interval is too short.
- Technical pricing `CONFLICT` **rejects** the Promise (whole evaluation
  `CONFLICT`); never returned as `UNAVAILABLE`.

| Existing method | Status |
|---|---|
| `getSnapshotReadyFacts` (locale-bound) | **Reuse unchanged** for non-Eligibility consumers |
| `getEligibilityPricingFacts` | **New** Eligibility projection |

## Providers — approval / verification / lifecycle

### New narrow projection

```ts
export type EligibilityProviderLifecycleFacts =
  | {
      readonly status: "MISSING";
      readonly providerId: string;
    }
  | {
      readonly status: "PRESENT";
      readonly providerId: string;
      readonly approved: boolean;
      readonly live: boolean;
      readonly suspended: boolean;
      readonly verificationSatisfiedOrNotRequired: boolean;
      readonly aggregateVersion: string;
    };

export interface EligibilityProviderLifecycleReader {
  getLifecycleFacts(providerId: string): Promise<EligibilityProviderLifecycleFacts>;
}

export type TransactionalEligibilityProviderLifecycleReaderFactory =
  (tx: Tx) => EligibilityProviderLifecycleReader;
```

**Invariants**

- Explicit nonexistent Provider → `MISSING` (business; Provider summary still
  required; exclusion reasons apply — not a technical failure).
- `PRESENT` with contradictory flags that violate Providers-owned lifecycle
  invariants (e.g. both live and suspended when that is illegal) →
  `INVALID_DEPENDENCY_DTO` (whole evaluation).
- Deny: `ownerUserId`, documents, contacts, payout identifiers.

| Existing | Status |
|---|---|
| `ProviderPublicReader` / setup readiness | **Reuse** for other consumers; **do not** forward raw DTOs to Eligibility |
| `getLifecycleFacts` | **New** |

## Providers — operational availability (P10)

### Reused

- Textual-area candidate discovery semantics.
- Coverage / schedule / pause / suspension blocker vocabulary where applicable.

### Extended for P11 — missing-config variants + Team budget (DEC-084)

```ts
export interface EligibilityTeamAvailabilityFacts {
  readonly teamId: string;
  readonly structurallyValid: boolean;
  readonly membersAvailableForWholeInterval: boolean;
  readonly cleanerGenderCounts: {
    readonly male: number;
    readonly female: number;
    readonly otherOrUnspecified: number;
  };
  /**
   * Providers-owned Escort validity aggregates — no Worker IDs, no raw members.
   * A Team is not excluded merely for lacking an Escort when none is required.
   * If no Escort is present and none is required, Escort-specific checks are
   * vacuously satisfied (escortRequired=false; present/valid and available flags
   * are true). If an Escort is present, escortPresentAndValid and
   * escortsAvailableForWholeInterval reflect actual validity and whole-interval
   * availability whether or not an Escort was required.
   * membersAvailableForWholeInterval includes every current member, including Escorts.
   */
  readonly escortFacts: {
    readonly escortRequired: boolean;
    readonly escortPresentAndValid: boolean;
    readonly escortsAvailableForWholeInterval: boolean;
  };
}

export type EligibilityMissingConfigurationKind =
  | "COVERAGE"
  | "PROVIDER_SCHEDULE"
  | "CAPACITY_RULE";

/**
 * Shared independently readable operational facts. Used by AVAILABLE_FACTS and
 * MISSING_CONFIGURATION so incomplete setup never discards readable coverage,
 * schedule, pause, suspension or Team evidence (DEC-064 / DEC-084 / PM-04).
 */
export interface EligibilityReadableAvailabilityFacts {
  readonly providerId: string;
  readonly coverageMatch: boolean;
  readonly providerScheduleAvailable: boolean;
  readonly paused: boolean;
  readonly suspended: boolean;
  /**
   * Positive integer from owned capacity config, or null when CAPACITY_RULE is
   * missing. Never invent zero for a missing rule.
   */
  readonly simultaneousTeamLimit: number | null;
  readonly teams: readonly EligibilityTeamAvailabilityFacts[];
}

export type EligibilityProviderAvailabilityFacts =
  | ({
      readonly status: "MISSING_CONFIGURATION";
      /** Non-empty list of absent settings. Pause/suspension are not categories. */
      readonly missingConfiguration: readonly EligibilityMissingConfigurationKind[];
    } & EligibilityReadableAvailabilityFacts)
  | ({
      readonly status: "AVAILABLE_FACTS";
      /** Capacity rule present — limit is a positive integer. */
      readonly simultaneousTeamLimit: number;
    } & Omit<EligibilityReadableAvailabilityFacts, "simultaneousTeamLimit">)
  | {
      readonly status: "OVERFLOW";
      readonly providerId: string;
      /** Accepted Teams before sentinel (≤ remainingTeamBudget). */
      readonly acceptedTeams: readonly EligibilityTeamAvailabilityFacts[];
    };

export interface EligibilityAvailabilityReader {
  discoverProviderIds(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly limit: number; // 500
  }): Promise<
    | { readonly status: "OK"; readonly providerIds: readonly string[] }
    | { readonly status: "OVERFLOW" }
  >;

  getAvailabilityFacts(input: {
    readonly providerId: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    /** Remaining portion of the 5,000 Team budget for this evaluation. */
    readonly remainingTeamBudget: number;
  }): Promise<EligibilityProviderAvailabilityFacts>;
}

export type TransactionalEligibilityAvailabilityReaderFactory =
  (tx: Tx) => EligibilityAvailabilityReader;
```

**Team budget / OVERFLOW**

- Eligibility evaluates Providers in **canonical Provider ID order**.
- Pass the remaining portion of the **5,000** Team budget on each availability
  read.
- The owning reader queries at most `remainingTeamBudget + 1` Teams (sentinel)
  before hydrating accepted Team facts.
- `OVERFLOW` (one Provider or combined Providers) → whole evaluation
  `EVALUATION_LIMIT_EXCEEDED` (no silent truncation).
- Covers both one Provider with excessive Teams and multiple Providers whose
  combined Team count exceeds 5,000.

**Missing configuration (`MISSING_CONFIGURATION`)**

- Preserve the same independently readable coverage, schedule, pause, suspension
  and Team fields as `AVAILABLE_FACTS` (via shared fact shape above).
- `missingConfiguration` is a non-empty list of `COVERAGE`, `PROVIDER_SCHEDULE`,
  and/or `CAPACITY_RULE`. Pause and suspension are operational facts, not
  missing-configuration categories.
- When `CAPACITY_RULE` is listed, `simultaneousTeamLimit` is `null` (never invent
  zero). Emit Eligibility reason `CAPACITY_RULE_MISSING` for that condition.
- Keep `NO_VALID_COMPLETE_TEAM` exclusively for an actual absence of qualifying
  Team structure — never as a substitute for missing configuration when Teams
  remain readable.
- Continue applying the Team budget and overflow rule whenever Team facts remain
  independently readable under incomplete configuration.

**Documented example:** Missing capacity rule + coverage mismatch + active pause
+ readable valid Team → truthful `CAPACITY_RULE_MISSING`, coverage and pause
exclusions; Team facts preserved; do **not** invent `NO_VALID_COMPLETE_TEAM`.

Do **not** throw a technical error for expected incomplete setup.

| Existing aggregate evaluation | Status |
|---|---|
| `ProviderOperationalAvailabilityReader` aggregate capacity | **Reuse** for P10 consumers; **do not** treat unfiltered aggregate as post-crew capacity |
| Team-level + discovery overflow + budget APIs above | **New / extended** |

## Providers — workforce boundary

Eligibility receives **Team aggregate gender/escort facts** only (above).
Worker IDs and raw member arrays are **forbidden** at the Eligibility boundary
(DEC-079). Existing `getBookingSafeTeamFacts` may remain for Bookings; P11 uses
the aggregate projection instead of forwarding workforce DTOs that contain
`workerId`.

## Configuration

| Capability | Actual method / factory | Status |
|---|---|---|
| Active country by id | `createTransactionalActiveCountryReader` → `getActiveCountryById` | **Reuse** |
| Active locality ancestry + country IANA zone | Transaction-bound locality / time-zone readers | **Reuse** |
| Tx-bound factory when reads run inside evaluation tx | Same factories | **Reuse** (must not open nested tx) |
| Safe version identifiers for `sourceVersions` metadata | Extend DTOs where missing | **Extend** if needed |

## Performance evidence port (Eligibility-owned) — DEC-084

```ts
export interface PerformanceEvidence {
  readonly providerId: string;
  readonly metricKey: string;
  readonly policyVersionId: string; // must match requested rule-version identity
  readonly value: string;           // canonical decimal
  readonly sampleCount: number;
  readonly observedAt: string;      // Instant UTC
}

/** Port returns complete evidence or MISSING only. Technical failures reject. */
export type PerformanceEvidenceResult =
  | { readonly status: "OK"; readonly evidence: PerformanceEvidence }
  | { readonly status: "MISSING" };

export interface PerformanceEvidencePort {
  getEvidence(input: {
    readonly providerId: string;
    readonly metricKey: string;
    readonly asOf: string; // evaluatedAt
    /** Selected rule-version identity for policy compatibility. */
    readonly policyVersionId: string;
  }): Promise<PerformanceEvidenceResult>;
}
```

- Port does **not** return `INSUFFICIENT_SAMPLES`, `MALFORMED`, or outage statuses
  as business results. Malformed / incompatible / outage → Promise rejection →
  whole-evaluation technical error.
- Returned `policyVersionId` **must equal** the requested identity; mismatch →
  technical integrity failure.
- Eligibility alone checks sample count, freshness
  (`observedAt + maxEvidenceAgeSeconds` vs `evaluatedAt`), and value against the
  pinned bundle parameters (canonical decimal threshold; positive integer
  `minimumSampleCount`; positive integer `maxEvidenceAgeSeconds`).
- No slow external call inside the transaction. Production gate remains
  disabled; enabled tests use deterministic local evidence.
- Port is **not called** when `performanceGate.enabled === false`
  (outcome `NOT_APPLICABLE`).

## Reachable dependency-state treatment (DEC-084 acceptance)

| State | Treatment |
|---|---|
| Usable facts (`AVAILABLE` / `PRESENT` / `AVAILABLE_FACTS` / evidence `OK`) | Evaluate rules |
| Expected business exclusion / prerequisite absence (`UNAVAILABLE`, `MISSING`, `MISSING_CONFIGURATION`, evidence `MISSING`) | Candidate outcome / dependent `NOT_EVALUATED` as specified |
| Team / discovery `OVERFLOW` | Whole-evaluation `EVALUATION_LIMIT_EXCEEDED` |
| Reader outage, invalid DTO, pricing CONFLICT, policy mismatch | Typed whole-evaluation failure |

## Anti-patterns (forbidden)

- Eligibility importing `*/infrastructure/*` or repositories of other modules
- Bound readers opening nested/independent transactions
- Per-rule database transactions
- Copying P09 price selection or P10 calendar arithmetic into Eligibility
- Inventing a locale to call localized snapshot APIs
- Forwarding raw workforce DTOs containing Worker IDs
- Using setup-readiness booleans (including `eligibleForPublicBrowse: false`)
  as runtime eligibility filters
- Inventing zero/default `simultaneousTeamLimit` for missing configuration
- Requiring every Team to contain an Escort
