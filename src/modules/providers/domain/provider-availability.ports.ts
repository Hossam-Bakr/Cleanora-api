/**
 * Providers-owned availability ports (R1-P10 Batch A: textual coverage).
 * Cross-module locality facts arrive only through Configuration's public
 * `LocalityReader`; Providers never queries Configuration's tables directly.
 */

import type {
  CountryTimeZoneReader,
  LocalityCityFact,
  LocalityDistrictFact,
} from "#modules/configuration/configuration.public";

import type {
  CoverageAreaSnapshot,
  CoverageSelectionInput,
  ProviderOperationalStatusSnapshot,
  ProviderCapacityRuleSnapshot,
  ProviderPauseRuntimeFacts,
  ProviderScheduleExceptionInput,
  ProviderScheduleExceptionSnapshot,
  ProviderTemporaryPauseSnapshot,
  ProviderWeeklyScheduleInput,
  ProviderWeeklyScheduleSnapshot,
  ProviderAvailabilityConfigurationSnapshot,
  WorkerAvailabilityConfigurationSnapshot,
  WorkerScheduleExceptionInput,
  WorkerScheduleExceptionSnapshot,
  WorkerWeeklyScheduleInput,
  WorkerWeeklyScheduleSnapshot,
} from "./provider-availability.types.js";
import type {
  ProviderTeamCapacityTeamFact,
} from "./provider-team-capacity.policy.js";

export type ProviderAvailabilityPauseCommandScope = "start" | "resume";

export interface ProviderAvailabilityMembershipFacts {
  readonly actorActive: boolean;
  readonly providerAdminEnabled: boolean;
  readonly providerApproved: boolean;
  readonly sameProvider: boolean;
  readonly membershipActive: boolean;
  readonly managementLevel: "OWNER" | "ADMIN" | null;
  /** Provider's own Profile country (DEC-056); `null` when unset. */
  readonly providerCountryId: string | null;
  /**
   * Trusted operational status for runtime evaluation (DEC-057).
   * Management authorization (DEC-058) ignores this field.
   */
  readonly operationalStatus: ProviderOperationalStatusSnapshot | null;
}

export interface ProviderAvailabilityAuthorizationReader {
  /** Locks the Provider row and resolves exact-scope OWNER/ADMIN authorization facts. */
  resolveAuthorityFacts(
    providerId: string,
    actorUserId: string,
  ): Promise<ProviderAvailabilityMembershipFacts>;
}

export interface ProviderAvailabilityLocalityReader {
  findCityById(cityId: string): Promise<LocalityCityFact | null>;
  findDistrictById(districtId: string): Promise<LocalityDistrictFact | null>;
  listActiveDistrictIdsForCity(cityId: string): Promise<readonly string[]>;
}

export type ProviderAvailabilityCountryTimeZoneReader = CountryTimeZoneReader;

export interface ProviderCoverageReceipt {
  readonly status: "PROCEED" | "REPLAYED";
  readonly safeResultJson?: unknown;
}

export type ProviderAvailabilityCommandReceipt = ProviderCoverageReceipt;

export interface ProviderAvailabilityRepository {
  findConfigurationByProviderId(
    providerId: string,
  ): Promise<ProviderAvailabilityConfigurationSnapshot | null>;

  /**
   * Reserve or replay one idempotent coverage-replace command bound to
   * `provider_availability_commands` (`scopeKey`+`idempotencyKey` unique).
   */
  reserveOrReplayCoverageCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderCoverageReceipt>;

  completeCoverageCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void>;

  /** Full replacement of the Provider's coverage set at an exact expected version. */
  replaceCoverage(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly selections: readonly CoverageSelectionInput[];
  }): Promise<ProviderAvailabilityConfigurationSnapshot | "VERSION_CONFLICT">;

  appendCoverageHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: readonly CoverageAreaSnapshot[];
    readonly safeAfter: readonly CoverageAreaSnapshot[];
  }): Promise<void>;

  /**
   * Reserve or replay one idempotent Provider calendar full-replace command.
   * The command covers weekly periods and dated exceptions together.
   */
  reserveOrReplayCalendarCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt>;

  completeCalendarCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void>;

  /** Full replacement of weekly Provider periods and dated exceptions. */
  replaceCalendar(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly weeklyPeriods: readonly ProviderWeeklyScheduleInput[];
    readonly exceptions: readonly ProviderScheduleExceptionInput[];
  }): Promise<ProviderAvailabilityConfigurationSnapshot | "VERSION_CONFLICT">;

  appendCalendarHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: {
      readonly weeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[];
      readonly exceptions: readonly ProviderScheduleExceptionSnapshot[];
    };
    readonly safeAfter: {
      readonly weeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[];
      readonly exceptions: readonly ProviderScheduleExceptionSnapshot[];
    };
  }): Promise<void>;

  /** Current unresolved pause (`resumed_at IS NULL`), including time-expired rows. */
  findCurrentPause(
    providerId: string,
  ): Promise<ProviderTemporaryPauseSnapshot | null>;

  /**
   * Operational status plus current unresolved pause for runtime blockers
   * (DEC-057). Does not mutate pause or configuration rows.
   */
  findPauseRuntimeFacts(providerId: string): Promise<ProviderPauseRuntimeFacts | null>;

  reserveOrReplayPauseCommand(input: {
    readonly providerId: string;
    readonly scope: ProviderAvailabilityPauseCommandScope;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt>;

  completePauseCommand(input: {
    readonly providerId: string;
    readonly scope: ProviderAvailabilityPauseCommandScope;
    readonly idempotencyKey: string;
    readonly safeResultCode: string;
    readonly safeResultJson: unknown;
  }): Promise<void>;

  /**
   * Start one immediate pause at `startedAt`. Conflicts when an unresolved
   * pause already exists; otherwise requires `expectedVersion === 0`.
   */
  startPause(input: {
    readonly providerId: string;
    readonly startedAt: Date;
    readonly endsAt: Date | null;
    readonly expectedVersion: number;
    readonly actorUserId: string;
  }): Promise<
    ProviderTemporaryPauseSnapshot | "PAUSE_CONFLICT" | "VERSION_CONFLICT"
  >;

  /**
   * Resume the unresolved pause early. Requires an exact pause version match.
   */
  resumePause(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly resumedAt: Date;
  }): Promise<
    ProviderTemporaryPauseSnapshot | "NOT_FOUND" | "VERSION_CONFLICT"
  >;

  appendPauseHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly eventCode: "pause.started" | "pause.resumed";
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: ProviderTemporaryPauseSnapshot | null;
    readonly safeAfter: ProviderTemporaryPauseSnapshot;
  }): Promise<void>;
}

export interface ProviderWorkerAvailabilityRepository {
  /**
   * Read a Worker calendar only when the Worker belongs to the exact Provider.
   * Missing and cross-Provider workers both return null for non-enumeration.
   */
  findWorkerCalendarByProviderId(input: {
    readonly providerId: string;
    readonly workerId: string;
  }): Promise<WorkerAvailabilityConfigurationSnapshot | null>;

  /**
   * Reserve or replay one idempotent Worker calendar full-replace command.
   * Scope is Worker-specific under `provider_availability_commands`.
   */
  reserveOrReplayWorkerCalendarCommand(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt>;

  completeWorkerCalendarCommand(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void>;

  /** Full replacement of weekly Worker periods and dated exceptions. */
  replaceWorkerCalendar(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly expectedVersion: number;
    readonly weeklyPeriods: readonly WorkerWeeklyScheduleInput[];
    readonly exceptions: readonly WorkerScheduleExceptionInput[];
  }): Promise<
    WorkerAvailabilityConfigurationSnapshot | "NOT_FOUND" | "VERSION_CONFLICT"
  >;

  appendWorkerCalendarHistory(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly targetVersion: number;
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: {
      readonly weeklyPeriods: readonly WorkerWeeklyScheduleSnapshot[];
      readonly exceptions: readonly WorkerScheduleExceptionSnapshot[];
    };
    readonly safeAfter: {
      readonly weeklyPeriods: readonly WorkerWeeklyScheduleSnapshot[];
      readonly exceptions: readonly WorkerScheduleExceptionSnapshot[];
    };
  }): Promise<void>;
}

export interface ProviderCapacityEvaluationFacts {
  readonly providerId: string;
  /** Provider-owned aggregate version advanced by every workforce mutation. */
  readonly workforceStateVersion: number;
  readonly applicationStatus:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "CHANGES_REQUESTED"
    | "APPROVED"
    | "REJECTED";
  readonly providerCountryId: string | null;
  readonly operationalStatus: ProviderOperationalStatusSnapshot;
  readonly pause: ProviderTemporaryPauseSnapshot | null;
  readonly capacityRule: ProviderCapacityRuleSnapshot | null;
  readonly providerWeeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[];
  readonly providerExceptions: readonly ProviderScheduleExceptionSnapshot[];
  readonly teams: readonly (Omit<ProviderTeamCapacityTeamFact, "members"> & {
    readonly teamVersion: number;
    readonly members: readonly (Omit<
      ProviderTeamCapacityTeamFact["members"][number],
      "availableForFullInterval"
    > & {
      readonly workerVersion: number;
      /** R1-P11 Eligibility Team aggregates (DEC-079); never forwarded as Worker IDs. */
      readonly gender: "male" | "female" | "other_or_unspecified";
      readonly workerType: "CLEANING_STAFF" | "ESCORT" | "OTHER";
      readonly weeklyPeriods: readonly WorkerWeeklyScheduleSnapshot[];
      readonly exceptions: readonly WorkerScheduleExceptionSnapshot[];
    })[];
  })[];
}

export interface ProviderCapacityRepository {
  findCapacityRuleByProviderId(
    providerId: string,
  ): Promise<ProviderCapacityRuleSnapshot | null>;

  reserveOrReplayCapacityCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt>;

  completeCapacityCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void>;

  replaceCapacityRule(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly maxSimultaneousTeams: number;
  }): Promise<ProviderCapacityRuleSnapshot | "VERSION_CONFLICT">;

  appendCapacityHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: ProviderCapacityRuleSnapshot | null;
    readonly safeAfter: ProviderCapacityRuleSnapshot;
  }): Promise<void>;

  findCapacityEvaluationFacts(
    providerId: string,
  ): Promise<ProviderCapacityEvaluationFacts | null>;
}

export interface ProviderOperationalAvailabilityRepository
  extends ProviderAvailabilityRepository,
    ProviderCapacityRepository {
  findCandidateProviderIdsForActiveTextualArea(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtIds: readonly string[];
  }): Promise<readonly string[]>;
}
