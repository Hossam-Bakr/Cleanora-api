/**
 * Provider textual coverage management service (R1-P10 Batch A).
 * Exact-scope active OWNER/enabled-ADMIN management for an approved Provider
 * in any operational state (DEC-058); full-replacement, UUID-idempotent,
 * Serializable writes (DEC-056).
 */

import { createHash } from "node:crypto";

import {
  ProviderAvailabilityError,
} from "./domain/provider-availability.errors.js";
import {
  validateDatedExceptions,
  validateSchedulePeriods,
} from "./domain/provider-availability-calendar.js";
import {
  decideProviderAvailabilityManagementAuthorization,
  matchesProviderCoverage,
  validateCoverageSelections,
} from "./domain/provider-availability.policy.js";
import {
  isEffectivePauseAt,
  isProviderRuntimeUnavailable,
  validatePauseEndsAt,
} from "./domain/provider-temporary-pause.policy.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderAvailabilityLocalityReader,
  ProviderAvailabilityRepository,
} from "./domain/provider-availability.ports.js";
import type {
  CoverageAreaSnapshot,
  CoverageSelectionInput,
  ProviderScheduleExceptionInput,
  ProviderScheduleExceptionSnapshot,
  ProviderTemporaryPauseSnapshot,
  ProviderWeeklyScheduleInput,
  ProviderWeeklyScheduleSnapshot,
  ProviderAvailabilityConfigurationSnapshot,
} from "./domain/provider-availability.types.js";

export interface ProviderAvailabilityCommandMeta {
  readonly actorUserId: string;
  readonly requestId?: string;
}

export interface CoverageAreaDto {
  readonly type: "CITY" | "DISTRICT";
  readonly id: string;
}

export interface ProviderCoverageDto {
  readonly providerId: string;
  readonly version: number;
  readonly coverage: readonly CoverageAreaDto[];
}

export interface ProviderWeeklyPeriodDto {
  readonly weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly endsNextDay: boolean;
}

export interface ProviderScheduleExceptionDto {
  readonly localDate: string;
  readonly closed: boolean;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly endsNextDay: boolean | null;
}

export interface ProviderCalendarDto {
  readonly providerId: string;
  readonly version: number;
  readonly weeklyPeriods: readonly ProviderWeeklyPeriodDto[];
  readonly exceptions: readonly ProviderScheduleExceptionDto[];
}

export interface ReplaceCoverageInput {
  readonly selections: readonly CoverageSelectionInput[];
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface ReplaceCalendarInput {
  readonly weeklyPeriods: readonly ProviderWeeklyScheduleInput[];
  readonly exceptions: readonly ProviderScheduleExceptionInput[];
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface ProviderTemporaryPauseDto {
  readonly id: string;
  readonly providerId: string;
  readonly startedAt: string;
  readonly endsAt: string | null;
  readonly resumedAt: string | null;
  readonly version: number;
  readonly effective: boolean;
}

export interface StartPauseInput {
  readonly endsAt?: Date | null;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface ResumePauseInput {
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export type ProviderRuntimeBlockerReason = "SUSPENDED" | "PAUSE";

export interface ProviderRuntimeBlockerEvaluation {
  readonly unavailable: boolean;
  readonly reason: ProviderRuntimeBlockerReason | null;
  readonly configurationUntouched: true;
}

/**
 * One transaction-bound unit of work: the Providers repository/authority
 * reader plus Configuration's transaction-bound `LocalityReader` (repair
 * item 2). Coverage validation must read localities inside the exact same
 * transaction as the coverage mutation — never a separately opened,
 * full-client reader — so a concurrent locality deactivation cannot be
 * observed inconsistently between the check and the write.
 */
export interface ProviderAvailabilityTransactionContext {
  readonly repository: ProviderAvailabilityRepository &
    ProviderAvailabilityAuthorizationReader;
  readonly localityReader: ProviderAvailabilityLocalityReader;
}

export interface ProviderAvailabilityServiceDependencies {
  readonly runInWriteTransaction: <T>(
    work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
  ) => Promise<T>;
  readonly runInReadTransaction: <T>(
    work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
  ) => Promise<T>;
}

function toCoverageDto(
  snapshot: ProviderAvailabilityConfigurationSnapshot,
): ProviderCoverageDto {
  return {
    providerId: snapshot.providerId,
    version: snapshot.version,
    coverage: snapshot.coverage.map((area) => ({
      type: area.type,
      id: area.type === "CITY" ? (area.cityId as string) : (area.districtId as string),
    })),
  };
}

function compareWeeklyPeriods(
  left: ProviderWeeklyPeriodDto,
  right: ProviderWeeklyPeriodDto,
): number {
  return (
    left.weekday - right.weekday ||
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute ||
    Number(left.endsNextDay) - Number(right.endsNextDay)
  );
}

function compareExceptions(
  left: ProviderScheduleExceptionDto,
  right: ProviderScheduleExceptionDto,
): number {
  return (
    left.localDate.localeCompare(right.localDate) ||
    Number(left.closed) - Number(right.closed) ||
    (left.startMinute ?? -1) - (right.startMinute ?? -1) ||
    (left.endMinute ?? -1) - (right.endMinute ?? -1) ||
    Number(left.endsNextDay ?? false) - Number(right.endsNextDay ?? false)
  );
}

function toWeeklyPeriodDto(
  period: ProviderWeeklyScheduleInput | ProviderWeeklyScheduleSnapshot,
): ProviderWeeklyPeriodDto {
  return {
    weekday: period.weekday,
    startMinute: period.startMinute,
    endMinute: period.endMinute,
    endsNextDay: period.endsNextDay,
  };
}

function toExceptionDto(
  exception: ProviderScheduleExceptionInput | ProviderScheduleExceptionSnapshot,
): ProviderScheduleExceptionDto {
  return {
    localDate: exception.localDate,
    closed: exception.closed,
    startMinute: exception.closed ? null : (exception.startMinute ?? null),
    endMinute: exception.closed ? null : (exception.endMinute ?? null),
    endsNextDay: exception.closed ? null : (exception.endsNextDay ?? false),
  };
}

function toCalendarDto(
  snapshot: ProviderAvailabilityConfigurationSnapshot,
): ProviderCalendarDto {
  return {
    providerId: snapshot.providerId,
    version: snapshot.version,
    weeklyPeriods: snapshot.weeklyPeriods.map(toWeeklyPeriodDto).sort(compareWeeklyPeriods),
    exceptions: snapshot.exceptions.map(toExceptionDto).sort(compareExceptions),
  };
}

/**
 * @desc Fingerprint every semantically relevant coverage-replace input.
 * @explanation Selections alone are insufficient: reusing a key with the same
 * selections but a different `expectedVersion` or `reasonCode` is still a
 * different command and must not silently replay a stale prior result.
 */
function fingerprintReplaceCoverageCommand(input: {
  readonly selections: readonly CoverageSelectionInput[];
  readonly expectedVersion: number;
  readonly reasonCode?: string;
}): string {
  const canonicalSelections = [...input.selections]
    .map((s) => `${s.type}:${s.id}`)
    .sort()
    .join("|");
  const canonical = JSON.stringify({
    selections: canonicalSelections,
    expectedVersion: input.expectedVersion,
    reasonCode: input.reasonCode ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function fingerprintReplaceCalendarCommand(input: {
  readonly weeklyPeriods: readonly ProviderWeeklyScheduleInput[];
  readonly exceptions: readonly ProviderScheduleExceptionInput[];
  readonly expectedVersion: number;
  readonly reasonCode?: string;
}): string {
  const canonical = JSON.stringify({
    weeklyPeriods: input.weeklyPeriods.map(toWeeklyPeriodDto).sort(compareWeeklyPeriods),
    exceptions: input.exceptions.map(toExceptionDto).sort(compareExceptions),
    expectedVersion: input.expectedVersion,
    reasonCode: input.reasonCode ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function toPauseDto(
  snapshot: ProviderTemporaryPauseSnapshot,
  at: Date = new Date(),
): ProviderTemporaryPauseDto {
  return {
    id: snapshot.id,
    providerId: snapshot.providerId,
    startedAt: snapshot.startedAt.toISOString(),
    endsAt: snapshot.endsAt === null ? null : snapshot.endsAt.toISOString(),
    resumedAt:
      snapshot.resumedAt === null ? null : snapshot.resumedAt.toISOString(),
    version: snapshot.version,
    effective: isEffectivePauseAt(snapshot, at),
  };
}

function fingerprintStartPauseCommand(input: {
  readonly endsAt: Date | null;
  readonly expectedVersion: number;
  readonly reasonCode?: string;
}): string {
  const canonical = JSON.stringify({
    endsAt: input.endsAt === null ? null : input.endsAt.toISOString(),
    expectedVersion: input.expectedVersion,
    reasonCode: input.reasonCode ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function fingerprintResumePauseCommand(input: {
  readonly expectedVersion: number;
  readonly reasonCode?: string;
}): string {
  const canonical = JSON.stringify({
    expectedVersion: input.expectedVersion,
    reasonCode: input.reasonCode ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export class ProviderAvailabilityService {
  public constructor(
    private readonly deps: ProviderAvailabilityServiceDependencies,
  ) {}

  /**
   * @desc Assert exact-scope active OWNER/enabled-ADMIN management (DEC-058)
   * and return the resolved trusted facts (including the Provider's own
   * country) for reuse.
   * @explanation Uses the Phase 10 availability-management policy, not
   * R1-P09's Provider Service policy: an active, exact-scope Owner is
   * trusted without an enabled `provider_admin` capability; an active,
   * exact-scope Admin still requires it.
   */
  private async assertManager(
    authReader: ProviderAvailabilityAuthorizationReader,
    providerId: string,
    actorUserId: string,
  ): Promise<{ readonly providerCountryId: string | null }> {
    const facts = await authReader.resolveAuthorityFacts(providerId, actorUserId);
    const decision = decideProviderAvailabilityManagementAuthorization(facts);
    if (!decision.allowed) {
      throw new ProviderAvailabilityError(
        decision.denialCode === "PROVIDER_AVAILABILITY_POLICY_NOT_FOUND"
          ? "PROVIDER_AVAILABILITY_NOT_FOUND"
          : decision.denialCode === "PROVIDER_AVAILABILITY_POLICY_PROVIDER_STATE_INVALID"
            ? "PROVIDER_AVAILABILITY_PROVIDER_STATE_INVALID"
            : "PROVIDER_AVAILABILITY_FORBIDDEN",
      );
    }
    return { providerCountryId: facts.providerCountryId };
  }

  public async getCoverage(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
  ): Promise<ProviderCoverageDto> {
    return this.deps.runInReadTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);
      const snapshot = await repository.findConfigurationByProviderId(providerId);
      if (snapshot === null) {
        return { providerId, version: 0, coverage: [] };
      }
      return toCoverageDto(snapshot);
    });
  }

  public async replaceCoverage(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
    input: ReplaceCoverageInput,
  ): Promise<{ readonly coverage: ProviderCoverageDto; readonly replayed: boolean }> {
    const validationError = validateCoverageSelections(input.selections);
    if (validationError !== null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
        `Coverage selection is invalid: ${validationError}`,
      );
    }

    return this.deps.runInWriteTransaction(async ({ repository, localityReader }) => {
      const { providerCountryId } = await this.assertManager(
        repository,
        providerId,
        meta.actorUserId,
      );

      const fingerprint = fingerprintReplaceCoverageCommand({
        selections: input.selections,
        expectedVersion: input.expectedVersion,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
      });
      const receipt = await repository.reserveOrReplayCoverageCommand({
        providerId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.actorUserId,
      });

      if (receipt.status === "REPLAYED") {
        if (receipt.safeResultJson === null || receipt.safeResultJson === undefined) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
            "Coverage idempotent replay target is missing",
          );
        }
        return {
          coverage: receipt.safeResultJson as unknown as ProviderCoverageDto,
          replayed: true,
        };
      }

      await this.validateSelectionsAgainstLocalities(
        localityReader,
        input.selections,
        providerCountryId,
      );

      const before = await repository.findConfigurationByProviderId(providerId);
      const result = await repository.replaceCoverage({
        providerId,
        expectedVersion: input.expectedVersion,
        selections: input.selections,
      });
      if (result === "VERSION_CONFLICT") {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
        );
      }

      await repository.appendCoverageHistory({
        providerId,
        targetId: result.id,
        targetVersion: result.version,
        actorUserId: meta.actorUserId,
        requestId: meta.requestId ?? input.idempotencyKey,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: before?.coverage ?? ([] as readonly CoverageAreaSnapshot[]),
        safeAfter: result.coverage,
      });

      const dto = toCoverageDto(result);
      await repository.completeCoverageCommand({
        providerId,
        idempotencyKey: input.idempotencyKey,
        safeResultJson: dto,
      });

      return { coverage: dto, replayed: false };
    });
  }

  public async getCalendar(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
  ): Promise<ProviderCalendarDto> {
    return this.deps.runInReadTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);
      const snapshot = await repository.findConfigurationByProviderId(providerId);
      if (snapshot === null) {
        return { providerId, version: 0, weeklyPeriods: [], exceptions: [] };
      }
      return toCalendarDto(snapshot);
    });
  }

  public async replaceCalendar(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
    input: ReplaceCalendarInput,
  ): Promise<{ readonly calendar: ProviderCalendarDto; readonly replayed: boolean }> {
    return this.deps.runInWriteTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);

      const fingerprint = fingerprintReplaceCalendarCommand({
        weeklyPeriods: input.weeklyPeriods,
        exceptions: input.exceptions,
        expectedVersion: input.expectedVersion,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
      });
      const receipt = await repository.reserveOrReplayCalendarCommand({
        providerId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.actorUserId,
      });

      if (receipt.status === "REPLAYED") {
        if (receipt.safeResultJson === null || receipt.safeResultJson === undefined) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
            "Provider calendar idempotent replay target is missing",
          );
        }
        return {
          calendar: receipt.safeResultJson as unknown as ProviderCalendarDto,
          replayed: true,
        };
      }

      this.validateCalendarInput(input);

      const before = await repository.findConfigurationByProviderId(providerId);
      const result = await repository.replaceCalendar({
        providerId,
        expectedVersion: input.expectedVersion,
        weeklyPeriods: input.weeklyPeriods,
        exceptions: input.exceptions,
      });
      if (result === "VERSION_CONFLICT") {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
        );
      }

      await repository.appendCalendarHistory({
        providerId,
        targetId: result.id,
        targetVersion: result.version,
        actorUserId: meta.actorUserId,
        requestId: meta.requestId ?? input.idempotencyKey,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: {
          weeklyPeriods: before?.weeklyPeriods ?? [],
          exceptions: before?.exceptions ?? [],
        },
        safeAfter: {
          weeklyPeriods: result.weeklyPeriods,
          exceptions: result.exceptions,
        },
      });

      const dto = toCalendarDto(result);
      await repository.completeCalendarCommand({
        providerId,
        idempotencyKey: input.idempotencyKey,
        safeResultJson: dto,
      });

      return { calendar: dto, replayed: false };
    });
  }

  private validateCalendarInput(input: ReplaceCalendarInput): void {
    const scheduleError = validateSchedulePeriods(input.weeklyPeriods);
    if (scheduleError !== null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_SCHEDULE_INVALID",
        `Provider weekly schedule is invalid: ${scheduleError}`,
      );
    }

    const exceptionError = validateDatedExceptions(input.exceptions);
    if (exceptionError !== null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_SCHEDULE_INVALID",
        `Provider schedule exceptions are invalid: ${exceptionError}`,
      );
    }
  }

  /**
   * @desc Read the current unresolved temporary pause, if any.
   * @explanation Time-expired rows remain visible as ineffective until a
   * later start materializes their terminal state and reuses the unique slot.
   */
  public async getPause(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
  ): Promise<ProviderTemporaryPauseDto | null> {
    return this.deps.runInReadTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);
      const pause = await repository.findCurrentPause(providerId);
      return pause === null ? null : toPauseDto(pause);
    });
  }

  /**
   * @desc Start one immediate temporary pause with optional automatic expiry.
   * @explanation `startedAt` is server `now`. A second effective pause is a
   * conflict; an expired bounded pause is terminalized transactionally so it
   * cannot block a later start. Approval/suspension/go-live stay untouched.
   */
  public async startPause(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
    input: StartPauseInput,
  ): Promise<{ readonly pause: ProviderTemporaryPauseDto; readonly replayed: boolean }> {
    return this.deps.runInWriteTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);

      const startedAt = new Date();
      const endsAt = input.endsAt === undefined ? null : input.endsAt;
      const endsAtError = validatePauseEndsAt(startedAt, endsAt);
      if (endsAtError !== null) {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_PAUSE_INVALID",
          `Provider temporary pause is invalid: ${endsAtError}`,
        );
      }

      const fingerprint = fingerprintStartPauseCommand({
        endsAt,
        expectedVersion: input.expectedVersion,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
      });
      const receipt = await repository.reserveOrReplayPauseCommand({
        providerId,
        scope: "start",
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.actorUserId,
      });

      if (receipt.status === "REPLAYED") {
        if (receipt.safeResultJson === null || receipt.safeResultJson === undefined) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
            "Pause start idempotent replay target is missing",
          );
        }
        return {
          pause: receipt.safeResultJson as unknown as ProviderTemporaryPauseDto,
          replayed: true,
        };
      }

      const result = await repository.startPause({
        providerId,
        startedAt,
        endsAt,
        expectedVersion: input.expectedVersion,
        actorUserId: meta.actorUserId,
      });
      if (result === "PAUSE_CONFLICT") {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_PAUSE_CONFLICT");
      }
      if (result === "VERSION_CONFLICT") {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_VERSION_CONFLICT");
      }

      await repository.appendPauseHistory({
        providerId,
        targetId: result.id,
        targetVersion: result.version,
        eventCode: "pause.started",
        actorUserId: meta.actorUserId,
        requestId: meta.requestId ?? input.idempotencyKey,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: null,
        safeAfter: result,
      });

      const dto = toPauseDto(result, startedAt);
      await repository.completePauseCommand({
        providerId,
        scope: "start",
        idempotencyKey: input.idempotencyKey,
        safeResultCode: "PAUSE_STARTED",
        safeResultJson: dto,
      });

      return { pause: dto, replayed: false };
    });
  }

  /**
   * @desc Resume the unresolved temporary pause early.
   * @explanation Clears the unique unresolved slot without altering approval,
   * suspension, go-live, or schedule/coverage configuration (DEC-057).
   */
  public async resumePause(
    meta: ProviderAvailabilityCommandMeta,
    providerId: string,
    input: ResumePauseInput,
  ): Promise<{ readonly pause: ProviderTemporaryPauseDto; readonly replayed: boolean }> {
    return this.deps.runInWriteTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);

      const fingerprint = fingerprintResumePauseCommand({
        expectedVersion: input.expectedVersion,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
      });
      const receipt = await repository.reserveOrReplayPauseCommand({
        providerId,
        scope: "resume",
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.actorUserId,
      });

      if (receipt.status === "REPLAYED") {
        if (receipt.safeResultJson === null || receipt.safeResultJson === undefined) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
            "Pause resume idempotent replay target is missing",
          );
        }
        return {
          pause: receipt.safeResultJson as unknown as ProviderTemporaryPauseDto,
          replayed: true,
        };
      }

      const before = await repository.findCurrentPause(providerId);
      const resumedAt = new Date();
      const result = await repository.resumePause({
        providerId,
        expectedVersion: input.expectedVersion,
        resumedAt,
      });
      if (result === "NOT_FOUND") {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_PAUSE_INVALID",
          "No unresolved temporary pause to resume",
        );
      }
      if (result === "VERSION_CONFLICT") {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_VERSION_CONFLICT");
      }

      await repository.appendPauseHistory({
        providerId,
        targetId: result.id,
        targetVersion: result.version,
        eventCode: "pause.resumed",
        actorUserId: meta.actorUserId,
        requestId: meta.requestId ?? input.idempotencyKey,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: before,
        safeAfter: result,
      });

      const dto = toPauseDto(result, resumedAt);
      await repository.completePauseCommand({
        providerId,
        scope: "resume",
        idempotencyKey: input.idempotencyKey,
        safeResultCode: "PAUSE_RESUMED",
        safeResultJson: dto,
      });

      return { pause: dto, replayed: false };
    });
  }

  /**
   * @desc Evaluate whether suspension or an overlapping effective pause blocks
   * runtime availability without mutating configuration (DEC-057 / T044).
   */
  public async evaluateRuntimeBlocker(
    providerId: string,
    options?: {
      readonly at?: Date;
      readonly interval?: { readonly start: Date; readonly end: Date };
    },
  ): Promise<ProviderRuntimeBlockerEvaluation> {
    return this.deps.runInReadTransaction(async ({ repository }) => {
      const facts = await repository.findPauseRuntimeFacts(providerId);
      if (facts === null) {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_NOT_FOUND");
      }

      const at = options?.at ?? new Date();
      const unavailable = isProviderRuntimeUnavailable({
        operationalStatus: facts.operationalStatus,
        pause: facts.pause,
        at,
        ...(options?.interval === undefined ? {} : { interval: options.interval }),
      });

      let reason: ProviderRuntimeBlockerReason | null = null;
      if (facts.operationalStatus === "SUSPENDED") {
        reason = "SUSPENDED";
      } else if (
        unavailable &&
        facts.pause !== null &&
        (options?.interval === undefined
          ? isEffectivePauseAt(facts.pause, at)
          : isProviderRuntimeUnavailable({
              operationalStatus: "LIVE",
              pause: facts.pause,
              at,
              interval: options.interval,
            }))
      ) {
        reason = "PAUSE";
      }

      return {
        unavailable,
        reason: unavailable ? reason : null,
        configurationUntouched: true,
      };
    });
  }

  /**
   * @desc Verify every selection exists, is addressable, and belongs to the
   * Provider's own configured country (DEC-056).
   * @explanation A Provider with no configured country can never validly
   * select coverage; every selection must match that exact country, not
   * merely agree with each other. The reader is the exact transaction-bound
   * instance the caller's write transaction supplied (repair item 2).
   */
  private async validateSelectionsAgainstLocalities(
    localityReader: ProviderAvailabilityLocalityReader,
    selections: readonly CoverageSelectionInput[],
    providerCountryId: string | null,
  ): Promise<void> {
    if (providerCountryId === null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
        "Provider has no configured country",
      );
    }
    for (const selection of selections) {
      if (selection.type === "CITY") {
        const city = await localityReader.findCityById(selection.id);
        if (city === null) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
            "City is not available",
          );
        }
        if (!city.isActive || !city.countryActive) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
            "City is not available",
          );
        }
        if (city.countryId !== providerCountryId) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
            "Coverage selection is outside the Provider's own country",
          );
        }
      } else {
        const district = await localityReader.findDistrictById(selection.id);
        if (district === null) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
            "District is not available",
          );
        }
        if (!district.isActive || !district.cityActive || !district.countryActive) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COVERAGE_INVALID",
            "District is not available",
          );
        }
        if (district.countryId !== providerCountryId) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_COVERAGE_COUNTRY_MISMATCH",
            "Coverage selection is outside the Provider's own country",
          );
        }
      }
    }
  }

  /**
   * @desc Pure evaluation: does this Provider's current coverage match a district?
   * @explanation Used by future browse/eligibility batches; exposed now so the
   * matching policy has one integration seam proven in this batch (DEC-056).
   * Reads the Provider's coverage and Configuration's locality facts inside
   * the same read transaction (repair item 2).
   */
  public async matchesDistrict(
    providerId: string,
    districtId: string,
  ): Promise<boolean> {
    return this.deps.runInReadTransaction(async ({ repository, localityReader }) => {
      const snapshot = await repository.findConfigurationByProviderId(providerId);
      if (snapshot === null) {
        return false;
      }
      const district = await localityReader.findDistrictById(districtId);
      if (district === null) {
        return false;
      }
      const coverageCityIds = snapshot.coverage
        .filter((area) => area.type === "CITY")
        .map((area) => area.cityId as string);
      const coverageDistrictIds = snapshot.coverage
        .filter((area) => area.type === "DISTRICT")
        .map((area) => area.districtId as string);
      return matchesProviderCoverage(
        { coverageCityIds, coverageDistrictIds },
        {
          districtId: district.id,
          cityId: district.cityId,
          districtActive: district.isActive,
          cityActive: district.cityActive,
          countryActive: district.countryActive,
        },
      );
    });
  }
}
