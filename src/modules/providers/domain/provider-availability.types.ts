/**
 * Providers-owned availability domain types (R1-P10).
 * Textual coverage, Provider weekly schedules and dated exceptions share the
 * single Provider availability configuration version.
 */

import type {
  DatedScheduleExceptionInput,
  WeeklySchedulePeriodInput,
} from "./provider-availability-calendar.js";

export type CoverageSelectionType = "CITY" | "DISTRICT";

export interface CoverageSelectionInput {
  readonly type: CoverageSelectionType;
  readonly id: string;
}

export interface CoverageAreaSnapshot {
  readonly id: string;
  readonly type: CoverageSelectionType;
  readonly cityId: string | null;
  readonly districtId: string | null;
}

export type ProviderWeeklyScheduleInput = WeeklySchedulePeriodInput;
export type WorkerWeeklyScheduleInput = WeeklySchedulePeriodInput;

export interface ProviderWeeklyScheduleSnapshot extends WeeklySchedulePeriodInput {
  readonly id: string;
}

export interface WorkerWeeklyScheduleSnapshot extends WeeklySchedulePeriodInput {
  readonly id: string;
}

export type ProviderScheduleExceptionInput = DatedScheduleExceptionInput;
export type WorkerScheduleExceptionInput = DatedScheduleExceptionInput;

export interface ProviderScheduleExceptionSnapshot {
  readonly id: string;
  readonly localDate: string;
  readonly closed: boolean;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly endsNextDay: boolean | null;
}

export interface WorkerScheduleExceptionSnapshot {
  readonly id: string;
  readonly localDate: string;
  readonly closed: boolean;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly endsNextDay: boolean | null;
}

export interface ProviderAvailabilityConfigurationSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly version: number;
  readonly coverage: readonly CoverageAreaSnapshot[];
  readonly weeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[];
  readonly exceptions: readonly ProviderScheduleExceptionSnapshot[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WorkerAvailabilityConfigurationSnapshot {
  readonly workerId: string;
  readonly providerId: string;
  readonly version: number;
  readonly weeklyPeriods: readonly WorkerWeeklyScheduleSnapshot[];
  readonly exceptions: readonly WorkerScheduleExceptionSnapshot[];
}

export interface ReplaceCoverageCommand {
  readonly selections: readonly CoverageSelectionInput[];
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface ReplaceProviderCalendarCommand {
  readonly weeklyPeriods: readonly ProviderWeeklyScheduleInput[];
  readonly exceptions: readonly ProviderScheduleExceptionInput[];
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface ReplaceWorkerCalendarCommand {
  readonly weeklyPeriods: readonly WorkerWeeklyScheduleInput[];
  readonly exceptions: readonly WorkerScheduleExceptionInput[];
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

/** Snapshot of one Provider temporary pause row (DEC-057). */
export interface ProviderTemporaryPauseSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly startedAt: Date;
  readonly endsAt: Date | null;
  readonly resumedAt: Date | null;
  readonly actorUserId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface StartProviderTemporaryPauseCommand {
  readonly endsAt?: Date | null;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface ResumeProviderTemporaryPauseCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export type ProviderOperationalStatusSnapshot =
  | "INACTIVE"
  | "LIVE"
  | "SUSPENDED";

/** Runtime facts for suspension/pause evaluation without mutating config. */
export interface ProviderPauseRuntimeFacts {
  readonly operationalStatus: ProviderOperationalStatusSnapshot;
  readonly pause: ProviderTemporaryPauseSnapshot | null;
}

export interface ProviderCapacityRuleSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly maxSimultaneousTeams: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ReplaceProviderCapacityRuleCommand {
  readonly maxSimultaneousTeams: number;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}
