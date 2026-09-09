/**
 * Worker calendar management service (R1-P10 Batch B2).
 * Worker schedules are Providers-owned and versioned with ProviderWorker.version.
 */

import { createHash } from "node:crypto";

import {
  availabilityIntervalsForCivilDate,
  intersectHalfOpenIntervals,
  type LocalCivilInterval,
  validateDatedExceptions,
  validateSchedulePeriods,
} from "./domain/provider-availability-calendar.js";
import { ProviderAvailabilityError } from "./domain/provider-availability.errors.js";
import { decideProviderAvailabilityManagementAuthorization } from "./domain/provider-availability.policy.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderWorkerAvailabilityRepository,
} from "./domain/provider-availability.ports.js";
import type {
  ProviderScheduleExceptionInput,
  ProviderWeeklyScheduleInput,
  WorkerAvailabilityConfigurationSnapshot,
  WorkerScheduleExceptionInput,
  WorkerScheduleExceptionSnapshot,
  WorkerWeeklyScheduleInput,
  WorkerWeeklyScheduleSnapshot,
} from "./domain/provider-availability.types.js";

export interface WorkerAvailabilityCommandMeta {
  readonly actorUserId: string;
  readonly requestId?: string;
}

export interface WorkerWeeklyPeriodDto {
  readonly weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly endsNextDay: boolean;
}

export interface WorkerScheduleExceptionDto {
  readonly localDate: string;
  readonly closed: boolean;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly endsNextDay: boolean | null;
}

export interface WorkerCalendarDto {
  readonly providerId: string;
  readonly workerId: string;
  readonly version: number;
  readonly weeklyPeriods: readonly WorkerWeeklyPeriodDto[];
  readonly exceptions: readonly WorkerScheduleExceptionDto[];
}

export interface ReplaceWorkerCalendarInput {
  readonly weeklyPeriods: readonly WorkerWeeklyScheduleInput[];
  readonly exceptions: readonly WorkerScheduleExceptionInput[];
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export interface WorkerAvailabilityTransactionContext {
  readonly repository: ProviderWorkerAvailabilityRepository &
    ProviderAvailabilityAuthorizationReader;
}

export interface ProviderWorkerAvailabilityServiceDependencies {
  readonly runInWriteTransaction: <T>(
    work: (context: WorkerAvailabilityTransactionContext) => Promise<T>,
  ) => Promise<T>;
  readonly runInReadTransaction: <T>(
    work: (context: WorkerAvailabilityTransactionContext) => Promise<T>,
  ) => Promise<T>;
}

export function intersectProviderWorkerAvailabilityForCivilDate(input: {
  readonly localDate: string;
  readonly providerWeeklyPeriods: readonly ProviderWeeklyScheduleInput[];
  readonly providerExceptions: readonly ProviderScheduleExceptionInput[];
  readonly workerWeeklyPeriods: readonly WorkerWeeklyScheduleInput[];
  readonly workerExceptions: readonly WorkerScheduleExceptionInput[];
}): readonly LocalCivilInterval[] {
  const providerIntervals = availabilityIntervalsForCivilDate({
    localDate: input.localDate,
    weeklyPeriods: input.providerWeeklyPeriods,
    exceptions: input.providerExceptions,
  });
  const workerIntervals = availabilityIntervalsForCivilDate({
    localDate: input.localDate,
    weeklyPeriods: input.workerWeeklyPeriods,
    exceptions: input.workerExceptions,
  });
  return intersectHalfOpenIntervals(providerIntervals, workerIntervals);
}

function compareWeeklyPeriods(
  left: WorkerWeeklyPeriodDto,
  right: WorkerWeeklyPeriodDto,
): number {
  return (
    left.weekday - right.weekday ||
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute ||
    Number(left.endsNextDay) - Number(right.endsNextDay)
  );
}

function compareExceptions(
  left: WorkerScheduleExceptionDto,
  right: WorkerScheduleExceptionDto,
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
  period: WorkerWeeklyScheduleInput | WorkerWeeklyScheduleSnapshot,
): WorkerWeeklyPeriodDto {
  return {
    weekday: period.weekday,
    startMinute: period.startMinute,
    endMinute: period.endMinute,
    endsNextDay: period.endsNextDay,
  };
}

function toExceptionDto(
  exception: WorkerScheduleExceptionInput | WorkerScheduleExceptionSnapshot,
): WorkerScheduleExceptionDto {
  return {
    localDate: exception.localDate,
    closed: exception.closed,
    startMinute: exception.closed ? null : (exception.startMinute ?? null),
    endMinute: exception.closed ? null : (exception.endMinute ?? null),
    endsNextDay: exception.closed ? null : (exception.endsNextDay ?? false),
  };
}

function toWorkerCalendarDto(
  snapshot: WorkerAvailabilityConfigurationSnapshot,
): WorkerCalendarDto {
  return {
    providerId: snapshot.providerId,
    workerId: snapshot.workerId,
    version: snapshot.version,
    weeklyPeriods: snapshot.weeklyPeriods.map(toWeeklyPeriodDto).sort(compareWeeklyPeriods),
    exceptions: snapshot.exceptions.map(toExceptionDto).sort(compareExceptions),
  };
}

function fingerprintReplaceWorkerCalendarCommand(input: {
  readonly weeklyPeriods: readonly WorkerWeeklyScheduleInput[];
  readonly exceptions: readonly WorkerScheduleExceptionInput[];
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

export class ProviderWorkerAvailabilityService {
  public constructor(
    private readonly deps: ProviderWorkerAvailabilityServiceDependencies,
  ) {}

  private async assertManager(
    authReader: ProviderAvailabilityAuthorizationReader,
    providerId: string,
    actorUserId: string,
  ): Promise<void> {
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
  }

  public async getWorkerCalendar(
    meta: WorkerAvailabilityCommandMeta,
    providerId: string,
    workerId: string,
  ): Promise<WorkerCalendarDto> {
    return this.deps.runInReadTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);
      const snapshot = await repository.findWorkerCalendarByProviderId({
        providerId,
        workerId,
      });
      if (snapshot === null) {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_NOT_FOUND");
      }
      return toWorkerCalendarDto(snapshot);
    });
  }

  public async replaceWorkerCalendar(
    meta: WorkerAvailabilityCommandMeta,
    providerId: string,
    workerId: string,
    input: ReplaceWorkerCalendarInput,
  ): Promise<{ readonly calendar: WorkerCalendarDto; readonly replayed: boolean }> {
    return this.deps.runInWriteTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);

      const before = await repository.findWorkerCalendarByProviderId({
        providerId,
        workerId,
      });
      if (before === null) {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_NOT_FOUND");
      }

      const fingerprint = fingerprintReplaceWorkerCalendarCommand({
        weeklyPeriods: input.weeklyPeriods,
        exceptions: input.exceptions,
        expectedVersion: input.expectedVersion,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
      });
      const receipt = await repository.reserveOrReplayWorkerCalendarCommand({
        providerId,
        workerId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.actorUserId,
      });

      if (receipt.status === "REPLAYED") {
        if (receipt.safeResultJson === null || receipt.safeResultJson === undefined) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
            "Worker calendar idempotent replay target is missing",
          );
        }
        return {
          calendar: receipt.safeResultJson as unknown as WorkerCalendarDto,
          replayed: true,
        };
      }

      this.validateCalendarInput(input);

      const result = await repository.replaceWorkerCalendar({
        providerId,
        workerId,
        expectedVersion: input.expectedVersion,
        weeklyPeriods: input.weeklyPeriods,
        exceptions: input.exceptions,
      });
      if (result === "NOT_FOUND") {
        throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_NOT_FOUND");
      }
      if (result === "VERSION_CONFLICT") {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
        );
      }

      await repository.appendWorkerCalendarHistory({
        providerId,
        workerId,
        targetVersion: result.version,
        actorUserId: meta.actorUserId,
        requestId: meta.requestId ?? input.idempotencyKey,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: {
          weeklyPeriods: before.weeklyPeriods,
          exceptions: before.exceptions,
        },
        safeAfter: {
          weeklyPeriods: result.weeklyPeriods,
          exceptions: result.exceptions,
        },
      });

      const dto = toWorkerCalendarDto(result);
      await repository.completeWorkerCalendarCommand({
        providerId,
        workerId,
        idempotencyKey: input.idempotencyKey,
        safeResultJson: dto,
      });

      return { calendar: dto, replayed: false };
    });
  }

  private validateCalendarInput(input: ReplaceWorkerCalendarInput): void {
    const scheduleError = validateSchedulePeriods(input.weeklyPeriods);
    if (scheduleError !== null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_SCHEDULE_INVALID",
        `Worker weekly schedule is invalid: ${scheduleError}`,
      );
    }

    const exceptionError = validateDatedExceptions(input.exceptions);
    if (exceptionError !== null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_SCHEDULE_INVALID",
        `Worker schedule exceptions are invalid: ${exceptionError}`,
      );
    }
  }
}
