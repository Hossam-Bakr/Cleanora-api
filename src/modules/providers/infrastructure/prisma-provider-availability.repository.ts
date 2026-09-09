/**
 * Prisma-backed persistence for Providers-owned availability (R1-P10 Batch A:
 * textual coverage). Serializable mutations, RepeatableRead evaluation reads.
 *
 * Authority facts are resolved from Providers-owned rows (Provider, Profile,
 * ProviderMember) plus Authentication's transaction-bound `ProviderIdentityReader`
 * adapter for account activity and the global `provider_admin` capability.
 * Providers never queries Authentication's role tables directly.
 */

import { getPrismaClient } from "#database/prisma";
import { Prisma } from "#generated/prisma/client";
import {
  createTransactionalProviderIdentityReader,
  type ProviderIdentityReader,
} from "#modules/authentication/authentication.public";
import {
  createTransactionalCountryTimeZoneReader,
  createTransactionalLocalityReader,
} from "#modules/configuration/configuration.public";

import { ProviderAvailabilityError } from "../domain/provider-availability.errors.js";
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
} from "../domain/provider-availability.types.js";
import type {
  ProviderAvailabilityCommandReceipt,
  ProviderAvailabilityAuthorizationReader,
  ProviderAvailabilityCountryTimeZoneReader,
  ProviderAvailabilityMembershipFacts,
  ProviderAvailabilityPauseCommandScope,
  ProviderAvailabilityRepository,
  ProviderCapacityEvaluationFacts,
  ProviderCapacityRepository,
  ProviderOperationalAvailabilityRepository,
  ProviderWorkerAvailabilityRepository,
  ProviderCoverageReceipt,
} from "../domain/provider-availability.ports.js";
import {
  isProviderAvailabilitySerializationFailure,
  mapPrismaProviderAvailabilityError,
  providerAvailabilitySerializationConflictError,
} from "./provider-availability-prisma-errors.js";

type AvailabilityDatabase = Pick<
  Prisma.TransactionClient,
  | "provider"
  | "providerMember"
  | "providerAvailabilityConfiguration"
  | "providerCoverageArea"
  | "providerSchedule"
  | "providerScheduleException"
  | "providerCapacityRule"
  | "providerTemporaryPause"
  | "providerAvailabilityCommand"
  | "providerAvailabilityHistory"
  | "providerWorker"
  | "providerTeam"
  | "workerSchedule"
  | "workerScheduleException"
>;

function coverageScopeKey(providerId: string): string {
  return `provider:${providerId}:availability.coverage.replace`;
}

function calendarScopeKey(providerId: string): string {
  return `provider:${providerId}:availability.schedule.configuration.replace`;
}

function workerCalendarScopeKey(providerId: string, workerId: string): string {
  return `provider:${providerId}:worker:${workerId}:availability.schedule.configuration.replace`;
}

function capacityScopeKey(providerId: string): string {
  return `provider:${providerId}:availability.capacity.replace`;
}

function pauseScopeKey(
  providerId: string,
  scope: ProviderAvailabilityPauseCommandScope,
): string {
  return `provider:${providerId}:availability.pause.${scope}`;
}

function toCoverageAreaSnapshot(row: {
  readonly id: string;
  readonly cityId: string | null;
  readonly districtId: string | null;
}): CoverageAreaSnapshot {
  return {
    id: row.id,
    type: row.cityId !== null ? "CITY" : "DISTRICT",
    cityId: row.cityId,
    districtId: row.districtId,
  };
}

function rethrowMapped(error: unknown): never {
  const mapped = mapPrismaProviderAvailabilityError(error);
  if (mapped !== null) throw mapped;
  throw error;
}

type ExistingCommandRow = {
  readonly status: "IN_PROGRESS" | "ACCEPTED";
  readonly requestFingerprint: string;
  readonly actorUserId: string | null;
  readonly safeResultJson: unknown;
};

export const SERIALIZABLE_WRITE_MAX_ATTEMPTS = 3;

type ProviderAvailabilityTransactionClient = Pick<
  ReturnType<typeof getPrismaClient>,
  "$transaction"
>;

export class PrismaProviderAvailabilityRepository
  implements
    ProviderAvailabilityRepository,
    ProviderWorkerAvailabilityRepository,
    ProviderCapacityRepository,
    ProviderOperationalAvailabilityRepository,
    ProviderAvailabilityAuthorizationReader
{
  public constructor(
    private readonly database: AvailabilityDatabase,
    private readonly identityReader: ProviderIdentityReader,
  ) {}

  public async resolveAuthorityFacts(
    providerId: string,
    actorUserId: string,
  ): Promise<ProviderAvailabilityMembershipFacts> {
    const provider = await this.database.provider.findUnique({
      where: { id: providerId },
      select: {
        applicationStatus: true,
        operationalStatus: true,
        profile: { select: { countryId: true } },
      },
    });
    if (provider === null) {
      return {
        actorActive: false,
        providerAdminEnabled: false,
        providerApproved: false,
        sameProvider: false,
        membershipActive: false,
        managementLevel: null,
        providerCountryId: null,
        operationalStatus: null,
      };
    }

    const [membership, identity] = await Promise.all([
      this.database.providerMember.findUnique({
        where: { providerId_userId: { providerId, userId: actorUserId } },
        select: { level: true, status: true },
      }),
      this.identityReader.getIdentity(actorUserId),
    ]);

    const managementLevel =
      membership?.level === "OWNER" || membership?.level === "ADMIN"
        ? membership.level
        : null;

    return {
      // Trusted, repository-resolved identity facts (never caller-supplied).
      actorActive: identity?.isActiveNonVerificationOnly === true,
      providerAdminEnabled: identity?.providerAdminEnabled === true,
      providerApproved: provider.applicationStatus === "APPROVED",
      sameProvider: true,
      membershipActive: membership?.status === "ACTIVE",
      managementLevel,
      providerCountryId: provider.profile?.countryId ?? null,
      operationalStatus:
        provider.operationalStatus as ProviderOperationalStatusSnapshot,
    };
  }

  public async findConfigurationByProviderId(
    providerId: string,
  ): Promise<ProviderAvailabilityConfigurationSnapshot | null> {
    const row = await this.database.providerAvailabilityConfiguration.findUnique(
      { where: { providerId } },
    );
    if (row === null) {
      return null;
    }
    const coverageAreas = await this.database.providerCoverageArea.findMany({
      where: { providerId },
      orderBy: [{ cityId: "asc" }, { districtId: "asc" }, { id: "asc" }],
    });
    const weeklyPeriods = await this.database.providerSchedule.findMany({
      where: { providerId },
      orderBy: [
        { weekday: "asc" },
        { startMinute: "asc" },
        { endMinute: "asc" },
        { endsNextDay: "asc" },
        { id: "asc" },
      ],
    });
    const exceptions = await this.database.providerScheduleException.findMany({
      where: { providerId },
      orderBy: [
        { localDate: "asc" },
        { closed: "asc" },
        { startMinute: "asc" },
        { endMinute: "asc" },
        { endsNextDay: "asc" },
        { id: "asc" },
      ],
    });
    return {
      id: row.id,
      providerId: row.providerId,
      version: row.version,
      coverage: coverageAreas.map(toCoverageAreaSnapshot),
      weeklyPeriods: weeklyPeriods.map(toWeeklyScheduleSnapshot),
      exceptions: exceptions.map(toScheduleExceptionSnapshot),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private commandLookupWhere(scopeKey: string, idempotencyKey: string) {
    return { scopeKey_idempotencyKey: { scopeKey, idempotencyKey } };
  }

  /**
   * @desc Decide the receipt for an existing command row: a different actor
   * or a fingerprint mismatch is a stable conflict (repair item 4); an
   * incomplete row is never a successful replay; only a matching, ACCEPTED
   * row with a safe result replays.
   */
  private receiptFromExistingCommand(
    existing: ExistingCommandRow,
    requestFingerprint: string,
    actorUserId: string,
  ): ProviderAvailabilityCommandReceipt {
    if (
      existing.requestFingerprint !== requestFingerprint ||
      existing.actorUserId !== actorUserId
    ) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT",
      );
    }
    if (
      existing.status !== "ACCEPTED" ||
      existing.safeResultJson === null ||
      existing.safeResultJson === undefined
    ) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_COMMAND_IN_PROGRESS",
      );
    }
    return { status: "REPLAYED", safeResultJson: existing.safeResultJson };
  }

  public async reserveOrReplayCoverageCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderCoverageReceipt> {
    const scopeKey = coverageScopeKey(input.providerId);
    const lookupWhere = this.commandLookupWhere(scopeKey, input.idempotencyKey);

    const existing = await this.database.providerAvailabilityCommand.findUnique(
      { where: lookupWhere },
    );
    if (existing !== null) {
      return this.receiptFromExistingCommand(
        existing,
        input.requestFingerprint,
        input.actorUserId,
      );
    }

    // Repair item 3: a plain `create` after a `findUnique` miss is not a
    // safe reservation on PostgreSQL — a concurrent unique violation aborts
    // the whole interactive transaction, so a follow-up query in the same
    // transaction cannot recover. `createMany({ skipDuplicates: true })`
    // performs a single conflict-tolerant statement (`INSERT ... ON
    // CONFLICT DO NOTHING` under the hood) that never aborts the
    // transaction; when it reserves zero rows, the winner already exists
    // and is read back and resolved exactly like a pre-existing row.
    const reserved = await this.database.providerAvailabilityCommand.createMany({
      data: [
        {
          providerId: input.providerId,
          scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          actorUserId: input.actorUserId,
          status: "IN_PROGRESS",
        },
      ],
      skipDuplicates: true,
    });
    if (reserved.count === 1) {
      return { status: "PROCEED" };
    }

    const raced = await this.database.providerAvailabilityCommand.findUnique({
      where: lookupWhere,
    });
    if (raced === null) {
      // Should be unreachable: skipDuplicates reported a duplicate but the
      // row cannot be found. Fail closed rather than silently proceeding.
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
        "Coverage command reservation raced but no row was found",
      );
    }
    return this.receiptFromExistingCommand(
      raced,
      input.requestFingerprint,
      input.actorUserId,
    );
  }

  public async completeCoverageCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void> {
    const scopeKey = coverageScopeKey(input.providerId);
    try {
      await this.database.providerAvailabilityCommand.update({
        where: this.commandLookupWhere(scopeKey, input.idempotencyKey),
        data: {
          status: "ACCEPTED",
          safeResultCode: "COVERAGE_REPLACED",
          safeResultJson: input.safeResultJson as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async replaceCoverage(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly selections: readonly CoverageSelectionInput[];
  }): Promise<ProviderAvailabilityConfigurationSnapshot | "VERSION_CONFLICT"> {
    try {
      const existing = await this.database.providerAvailabilityConfiguration.findUnique(
        { where: { providerId: input.providerId } },
      );

      if (existing === null) {
        if (input.expectedVersion !== 0) {
          return "VERSION_CONFLICT";
        }
        await this.database.providerAvailabilityConfiguration.create(
          { data: { providerId: input.providerId, version: 1 } },
        );
      } else {
        if (existing.version !== input.expectedVersion) {
          return "VERSION_CONFLICT";
        }
        const result = await this.database.providerAvailabilityConfiguration.updateMany(
          {
            where: { providerId: input.providerId, version: input.expectedVersion },
            data: { version: { increment: 1 } },
          },
        );
        if (result.count === 0) {
          return "VERSION_CONFLICT";
        }
      }

      await this.database.providerCoverageArea.deleteMany({
        where: { providerId: input.providerId },
      });
      if (input.selections.length > 0) {
        await this.database.providerCoverageArea.createMany({
          data: input.selections.map((selection) => ({
            providerId: input.providerId,
            cityId: selection.type === "CITY" ? selection.id : null,
            districtId: selection.type === "DISTRICT" ? selection.id : null,
          })),
        });
      }

      const snapshot = await this.findConfigurationByProviderId(input.providerId);
      if (snapshot === null) {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
          "Coverage replacement completed without a configuration snapshot",
        );
      }
      return snapshot;
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async appendCoverageHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: readonly CoverageAreaSnapshot[];
    readonly safeAfter: readonly CoverageAreaSnapshot[];
  }): Promise<void> {
    await this.database.providerAvailabilityHistory.create({
      data: {
        providerId: input.providerId,
        targetType: "COVERAGE",
        targetId: input.targetId,
        targetVersion: input.targetVersion,
        eventCode: "coverage.replaced",
        actorUserId: input.actorUserId,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: input.safeBefore as unknown as Prisma.InputJsonValue,
        safeAfter: input.safeAfter as unknown as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    });
  }

  public async reserveOrReplayCalendarCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt> {
    const scopeKey = calendarScopeKey(input.providerId);
    const lookupWhere = this.commandLookupWhere(scopeKey, input.idempotencyKey);

    const existing = await this.database.providerAvailabilityCommand.findUnique(
      { where: lookupWhere },
    );
    if (existing !== null) {
      return this.receiptFromExistingCommand(
        existing,
        input.requestFingerprint,
        input.actorUserId,
      );
    }

    const reserved = await this.database.providerAvailabilityCommand.createMany({
      data: [
        {
          providerId: input.providerId,
          scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          actorUserId: input.actorUserId,
          status: "IN_PROGRESS",
        },
      ],
      skipDuplicates: true,
    });
    if (reserved.count === 1) {
      return { status: "PROCEED" };
    }

    const raced = await this.database.providerAvailabilityCommand.findUnique({
      where: lookupWhere,
    });
    if (raced === null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
        "Calendar command reservation raced but no row was found",
      );
    }
    return this.receiptFromExistingCommand(
      raced,
      input.requestFingerprint,
      input.actorUserId,
    );
  }

  public async completeCalendarCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void> {
    const scopeKey = calendarScopeKey(input.providerId);
    try {
      await this.database.providerAvailabilityCommand.update({
        where: this.commandLookupWhere(scopeKey, input.idempotencyKey),
        data: {
          status: "ACCEPTED",
          safeResultCode: "SCHEDULE_CONFIGURATION_REPLACED",
          safeResultJson: input.safeResultJson as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async replaceCalendar(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly weeklyPeriods: readonly ProviderWeeklyScheduleInput[];
    readonly exceptions: readonly ProviderScheduleExceptionInput[];
  }): Promise<ProviderAvailabilityConfigurationSnapshot | "VERSION_CONFLICT"> {
    try {
      const existing = await this.database.providerAvailabilityConfiguration.findUnique(
        { where: { providerId: input.providerId } },
      );

      if (existing === null) {
        if (input.expectedVersion !== 0) {
          return "VERSION_CONFLICT";
        }
        await this.database.providerAvailabilityConfiguration.create(
          { data: { providerId: input.providerId, version: 1 } },
        );
      } else {
        if (existing.version !== input.expectedVersion) {
          return "VERSION_CONFLICT";
        }
        const result = await this.database.providerAvailabilityConfiguration.updateMany(
          {
            where: { providerId: input.providerId, version: input.expectedVersion },
            data: { version: { increment: 1 } },
          },
        );
        if (result.count === 0) {
          return "VERSION_CONFLICT";
        }
      }

      await this.database.providerSchedule.deleteMany({
        where: { providerId: input.providerId },
      });
      await this.database.providerScheduleException.deleteMany({
        where: { providerId: input.providerId },
      });

      if (input.weeklyPeriods.length > 0) {
        await this.database.providerSchedule.createMany({
          data: input.weeklyPeriods.map((period) => ({
            providerId: input.providerId,
            weekday: period.weekday,
            startMinute: period.startMinute,
            endMinute: period.endMinute,
            endsNextDay: period.endsNextDay,
          })),
        });
      }

      if (input.exceptions.length > 0) {
        await this.database.providerScheduleException.createMany({
          data: input.exceptions.map((exception) => ({
            providerId: input.providerId,
            localDate: localDateToDatabase(exception.localDate),
            closed: exception.closed,
            startMinute: exception.closed ? null : (exception.startMinute ?? null),
            endMinute: exception.closed ? null : (exception.endMinute ?? null),
            endsNextDay: exception.closed ? false : (exception.endsNextDay ?? false),
          })),
        });
      }

      const snapshot = await this.findConfigurationByProviderId(input.providerId);
      if (snapshot === null) {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
          "Calendar replacement completed without a configuration snapshot",
        );
      }
      return snapshot;
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async appendCalendarHistory(input: {
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
  }): Promise<void> {
    await this.database.providerAvailabilityHistory.create({
      data: {
        providerId: input.providerId,
        targetType: "SCHEDULE",
        targetId: input.targetId,
        targetVersion: input.targetVersion,
        eventCode: "schedule.configuration.replaced",
        actorUserId: input.actorUserId,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: input.safeBefore as unknown as Prisma.InputJsonValue,
        safeAfter: input.safeAfter as unknown as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    });
  }

  public async findWorkerCalendarByProviderId(input: {
    readonly providerId: string;
    readonly workerId: string;
  }): Promise<WorkerAvailabilityConfigurationSnapshot | null> {
    const worker = await this.database.providerWorker.findFirst({
      where: {
        id: input.workerId,
        providerId: input.providerId,
      },
      select: {
        id: true,
        providerId: true,
        version: true,
      },
    });
    if (worker === null) {
      return null;
    }

    const weeklyPeriods = await this.database.workerSchedule.findMany({
      where: { workerId: input.workerId },
      orderBy: [
        { weekday: "asc" },
        { startMinute: "asc" },
        { endMinute: "asc" },
        { endsNextDay: "asc" },
        { id: "asc" },
      ],
    });
    const exceptions = await this.database.workerScheduleException.findMany({
      where: { workerId: input.workerId },
      orderBy: [
        { localDate: "asc" },
        { closed: "asc" },
        { startMinute: "asc" },
        { endMinute: "asc" },
        { endsNextDay: "asc" },
        { id: "asc" },
      ],
    });

    return {
      workerId: worker.id,
      providerId: worker.providerId,
      version: worker.version,
      weeklyPeriods: weeklyPeriods.map(toWorkerWeeklyScheduleSnapshot),
      exceptions: exceptions.map(toWorkerScheduleExceptionSnapshot),
    };
  }

  public async reserveOrReplayWorkerCalendarCommand(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt> {
    const scopeKey = workerCalendarScopeKey(input.providerId, input.workerId);
    const lookupWhere = this.commandLookupWhere(scopeKey, input.idempotencyKey);

    const existing = await this.database.providerAvailabilityCommand.findUnique(
      { where: lookupWhere },
    );
    if (existing !== null) {
      return this.receiptFromExistingCommand(
        existing,
        input.requestFingerprint,
        input.actorUserId,
      );
    }

    const reserved = await this.database.providerAvailabilityCommand.createMany({
      data: [
        {
          providerId: input.providerId,
          scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          actorUserId: input.actorUserId,
          status: "IN_PROGRESS",
        },
      ],
      skipDuplicates: true,
    });
    if (reserved.count === 1) {
      return { status: "PROCEED" };
    }

    const raced = await this.database.providerAvailabilityCommand.findUnique({
      where: lookupWhere,
    });
    if (raced === null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
        "Worker calendar command reservation raced but no row was found",
      );
    }
    return this.receiptFromExistingCommand(
      raced,
      input.requestFingerprint,
      input.actorUserId,
    );
  }

  public async completeWorkerCalendarCommand(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void> {
    const scopeKey = workerCalendarScopeKey(input.providerId, input.workerId);
    try {
      await this.database.providerAvailabilityCommand.update({
        where: this.commandLookupWhere(scopeKey, input.idempotencyKey),
        data: {
          status: "ACCEPTED",
          safeResultCode: "WORKER_SCHEDULE_CONFIGURATION_REPLACED",
          safeResultJson: input.safeResultJson as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async replaceWorkerCalendar(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly expectedVersion: number;
    readonly weeklyPeriods: readonly WorkerWeeklyScheduleInput[];
    readonly exceptions: readonly WorkerScheduleExceptionInput[];
  }): Promise<
    WorkerAvailabilityConfigurationSnapshot | "NOT_FOUND" | "VERSION_CONFLICT"
  > {
    try {
      const worker = await this.database.providerWorker.findUnique({
        where: { id: input.workerId },
        select: { providerId: true, version: true },
      });
      if (worker === null || worker.providerId !== input.providerId) {
        return "NOT_FOUND";
      }
      if (worker.version !== input.expectedVersion) {
        return "VERSION_CONFLICT";
      }

      const updated = await this.database.providerWorker.updateMany({
        where: {
          id: input.workerId,
          providerId: input.providerId,
          version: input.expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (updated.count === 0) {
        return "VERSION_CONFLICT";
      }

      // Worker calendars are workforce truth. Advance the Provider-owned
      // aggregate so public operational facts expose a version that changes
      // for every Worker/Team mutation, rather than a lossy max of unrelated
      // row versions.
      await this.database.provider.update({
        where: { id: input.providerId },
        data: { workforceStateVersion: { increment: 1 } },
      });

      await this.database.workerSchedule.deleteMany({
        where: { workerId: input.workerId },
      });
      await this.database.workerScheduleException.deleteMany({
        where: { workerId: input.workerId },
      });

      if (input.weeklyPeriods.length > 0) {
        await this.database.workerSchedule.createMany({
          data: input.weeklyPeriods.map((period) => ({
            workerId: input.workerId,
            weekday: period.weekday,
            startMinute: period.startMinute,
            endMinute: period.endMinute,
            endsNextDay: period.endsNextDay,
          })),
        });
      }

      if (input.exceptions.length > 0) {
        await this.database.workerScheduleException.createMany({
          data: input.exceptions.map((exception) => ({
            workerId: input.workerId,
            localDate: localDateToDatabase(exception.localDate),
            closed: exception.closed,
            startMinute: exception.closed ? null : (exception.startMinute ?? null),
            endMinute: exception.closed ? null : (exception.endMinute ?? null),
            endsNextDay: exception.closed ? false : (exception.endsNextDay ?? false),
          })),
        });
      }

      const snapshot = await this.findWorkerCalendarByProviderId({
        providerId: input.providerId,
        workerId: input.workerId,
      });
      if (snapshot === null) {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
          "Worker calendar replacement completed without a Worker snapshot",
        );
      }
      return snapshot;
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async appendWorkerCalendarHistory(input: {
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
  }): Promise<void> {
    await this.database.providerAvailabilityHistory.create({
      data: {
        providerId: input.providerId,
        targetType: "WORKER_SCHEDULE",
        targetId: input.workerId,
        targetVersion: input.targetVersion,
        eventCode: "worker.schedule.configuration.replaced",
        actorUserId: input.actorUserId,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: input.safeBefore as unknown as Prisma.InputJsonValue,
        safeAfter: input.safeAfter as unknown as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    });
  }

  public async findCapacityRuleByProviderId(
    providerId: string,
  ): Promise<ProviderCapacityRuleSnapshot | null> {
    const row = await this.database.providerCapacityRule.findUnique({
      where: { providerId },
    });
    return row === null ? null : toCapacityRuleSnapshot(row);
  }

  public async reserveOrReplayCapacityCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt> {
    const scopeKey = capacityScopeKey(input.providerId);
    const lookupWhere = this.commandLookupWhere(scopeKey, input.idempotencyKey);

    const existing = await this.database.providerAvailabilityCommand.findUnique(
      { where: lookupWhere },
    );
    if (existing !== null) {
      return this.receiptFromExistingCommand(
        existing,
        input.requestFingerprint,
        input.actorUserId,
      );
    }

    const reserved = await this.database.providerAvailabilityCommand.createMany({
      data: [
        {
          providerId: input.providerId,
          scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          actorUserId: input.actorUserId,
          status: "IN_PROGRESS",
        },
      ],
      skipDuplicates: true,
    });
    if (reserved.count === 1) {
      return { status: "PROCEED" };
    }

    const raced = await this.database.providerAvailabilityCommand.findUnique({
      where: lookupWhere,
    });
    if (raced === null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
        "Capacity command reservation raced but no row was found",
      );
    }
    return this.receiptFromExistingCommand(
      raced,
      input.requestFingerprint,
      input.actorUserId,
    );
  }

  public async completeCapacityCommand(input: {
    readonly providerId: string;
    readonly idempotencyKey: string;
    readonly safeResultJson: unknown;
  }): Promise<void> {
    const scopeKey = capacityScopeKey(input.providerId);
    try {
      await this.database.providerAvailabilityCommand.update({
        where: this.commandLookupWhere(scopeKey, input.idempotencyKey),
        data: {
          status: "ACCEPTED",
          safeResultCode: "CAPACITY_REPLACED",
          safeResultJson: input.safeResultJson as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async replaceCapacityRule(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly maxSimultaneousTeams: number;
  }): Promise<ProviderCapacityRuleSnapshot | "VERSION_CONFLICT"> {
    try {
      const existing = await this.database.providerCapacityRule.findUnique({
        where: { providerId: input.providerId },
      });

      if (existing === null) {
        if (input.expectedVersion !== 0) {
          return "VERSION_CONFLICT";
        }
        const created = await this.database.providerCapacityRule.create({
          data: {
            providerId: input.providerId,
            maxSimultaneousTeams: input.maxSimultaneousTeams,
            version: 1,
          },
        });
        return toCapacityRuleSnapshot(created);
      }

      if (existing.version !== input.expectedVersion) {
        return "VERSION_CONFLICT";
      }
      const changed = await this.database.providerCapacityRule.updateMany({
        where: {
          providerId: input.providerId,
          version: input.expectedVersion,
        },
        data: {
          maxSimultaneousTeams: input.maxSimultaneousTeams,
          version: { increment: 1 },
        },
      });
      if (changed.count === 0) {
        return "VERSION_CONFLICT";
      }

      const row = await this.database.providerCapacityRule.findUnique({
        where: { providerId: input.providerId },
      });
      if (row === null) {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
          "Capacity replacement completed without a capacity snapshot",
        );
      }
      return toCapacityRuleSnapshot(row);
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async appendCapacityHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: ProviderCapacityRuleSnapshot | null;
    readonly safeAfter: ProviderCapacityRuleSnapshot;
  }): Promise<void> {
    await this.database.providerAvailabilityHistory.create({
      data: {
        providerId: input.providerId,
        targetType: "CAPACITY",
        targetId: input.targetId,
        targetVersion: input.targetVersion,
        eventCode: "capacity.replaced",
        actorUserId: input.actorUserId,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: input.safeBefore as unknown as Prisma.InputJsonValue,
        safeAfter: input.safeAfter as unknown as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    });
  }

  public async findCapacityEvaluationFacts(providerId: string) {
    const provider = await this.database.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        workforceStateVersion: true,
        applicationStatus: true,
        operationalStatus: true,
        profile: { select: { countryId: true } },
      },
    });
    if (provider === null) {
      return null;
    }

    const [capacityRule, providerWeeklyPeriods, providerExceptions, teams] =
      await Promise.all([
        this.database.providerCapacityRule.findUnique({ where: { providerId } }),
        this.database.providerSchedule.findMany({
          where: { providerId },
          orderBy: [
            { weekday: "asc" },
            { startMinute: "asc" },
            { endMinute: "asc" },
            { endsNextDay: "asc" },
            { id: "asc" },
          ],
        }),
        this.database.providerScheduleException.findMany({
          where: { providerId },
          orderBy: [
            { localDate: "asc" },
            { closed: "asc" },
            { startMinute: "asc" },
            { endMinute: "asc" },
            { endsNextDay: "asc" },
            { id: "asc" },
          ],
        }),
        this.database.providerTeam.findMany({
          where: { providerId },
          orderBy: [{ id: "asc" }],
          include: {
            memberships: {
              where: { endedAt: null },
              orderBy: [{ startedAt: "asc" }, { id: "asc" }],
              include: {
                worker: {
                  select: {
                    id: true,
                    version: true,
                    status: true,
                    endedAt: true,
                    profile: {
                      select: {
                        gender: true,
                        workerType: true,
                      },
                    },
                    schedules: {
                      orderBy: [
                        { weekday: "asc" },
                        { startMinute: "asc" },
                        { endMinute: "asc" },
                        { endsNextDay: "asc" },
                        { id: "asc" },
                      ],
                    },
                    scheduleExceptions: {
                      orderBy: [
                        { localDate: "asc" },
                        { closed: "asc" },
                        { startMinute: "asc" },
                        { endMinute: "asc" },
                        { endsNextDay: "asc" },
                        { id: "asc" },
                      ],
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

    return {
      providerId: provider.id,
      workforceStateVersion: provider.workforceStateVersion,
      applicationStatus: provider.applicationStatus,
      providerCountryId: provider.profile?.countryId ?? null,
      operationalStatus:
        provider.operationalStatus as ProviderOperationalStatusSnapshot,
      pause: await this.findCurrentPause(providerId),
      capacityRule:
        capacityRule === null ? null : toCapacityRuleSnapshot(capacityRule),
      providerWeeklyPeriods: providerWeeklyPeriods.map(toWeeklyScheduleSnapshot),
      providerExceptions: providerExceptions.map(toScheduleExceptionSnapshot),
      teams: teams.map((team) => ({
        teamId: team.id,
        teamVersion: team.version,
        status: team.status,
        members: team.memberships.map((membership) => ({
          workerId: membership.workerId,
          workerVersion: membership.worker.version,
          cleans: membership.cleans,
          workerStatus:
            membership.worker.endedAt === null
              ? membership.worker.status
              : "INACTIVE",
          gender:
            membership.worker.profile?.gender === "MALE"
              ? ("male" as const)
              : membership.worker.profile?.gender === "FEMALE"
                ? ("female" as const)
                : ("other_or_unspecified" as const),
          workerType:
            membership.worker.profile?.workerType === "ESCORT"
              ? ("ESCORT" as const)
              : membership.worker.profile?.workerType === "OTHER"
                ? ("OTHER" as const)
                : ("CLEANING_STAFF" as const),
          weeklyPeriods: membership.worker.schedules.map(
            toWorkerWeeklyScheduleSnapshot,
          ),
          exceptions: membership.worker.scheduleExceptions.map(
            toWorkerScheduleExceptionSnapshot,
          ),
        })),
      })),
    };
  }

  public async findCandidateProviderIdsForActiveTextualArea(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtIds: readonly string[];
  }): Promise<readonly string[]> {
    const rows = await this.database.providerCoverageArea.findMany({
      where: {
        OR: [
          { cityId: input.cityId },
          ...(input.districtIds.length === 0
            ? []
            : [{ districtId: { in: [...input.districtIds] } }]),
        ],
        provider: {
          applicationStatus: "APPROVED",
          profile: { countryId: input.countryId },
        },
      },
      select: { providerId: true },
      distinct: ["providerId"],
      orderBy: { providerId: "asc" },
    });
    return rows.map((row) => row.providerId);
  }

  public async findCurrentPause(
    providerId: string,
  ): Promise<ProviderTemporaryPauseSnapshot | null> {
    const row = await this.database.providerTemporaryPause.findFirst({
      where: { providerId, resumedAt: null },
      orderBy: { startedAt: "desc" },
    });
    return row === null ? null : toTemporaryPauseSnapshot(row);
  }

  public async findPauseRuntimeFacts(
    providerId: string,
  ): Promise<ProviderPauseRuntimeFacts | null> {
    const provider = await this.database.provider.findUnique({
      where: { id: providerId },
      select: { operationalStatus: true },
    });
    if (provider === null) {
      return null;
    }
    return {
      operationalStatus:
        provider.operationalStatus as ProviderOperationalStatusSnapshot,
      pause: await this.findCurrentPause(providerId),
    };
  }

  public async reserveOrReplayPauseCommand(input: {
    readonly providerId: string;
    readonly scope: ProviderAvailabilityPauseCommandScope;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<ProviderAvailabilityCommandReceipt> {
    const scopeKey = pauseScopeKey(input.providerId, input.scope);
    const lookupWhere = this.commandLookupWhere(scopeKey, input.idempotencyKey);

    const existing = await this.database.providerAvailabilityCommand.findUnique(
      { where: lookupWhere },
    );
    if (existing !== null) {
      return this.receiptFromExistingCommand(
        existing,
        input.requestFingerprint,
        input.actorUserId,
      );
    }

    const reserved = await this.database.providerAvailabilityCommand.createMany({
      data: [
        {
          providerId: input.providerId,
          scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          actorUserId: input.actorUserId,
          status: "IN_PROGRESS",
        },
      ],
      skipDuplicates: true,
    });
    if (reserved.count === 1) {
      return { status: "PROCEED" };
    }

    const raced = await this.database.providerAvailabilityCommand.findUnique({
      where: lookupWhere,
    });
    if (raced === null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
        "Pause command reservation raced but no row was found",
      );
    }
    return this.receiptFromExistingCommand(
      raced,
      input.requestFingerprint,
      input.actorUserId,
    );
  }

  public async completePauseCommand(input: {
    readonly providerId: string;
    readonly scope: ProviderAvailabilityPauseCommandScope;
    readonly idempotencyKey: string;
    readonly safeResultCode: string;
    readonly safeResultJson: unknown;
  }): Promise<void> {
    const scopeKey = pauseScopeKey(input.providerId, input.scope);
    try {
      await this.database.providerAvailabilityCommand.update({
        where: this.commandLookupWhere(scopeKey, input.idempotencyKey),
        data: {
          status: "ACCEPTED",
          safeResultCode: input.safeResultCode,
          safeResultJson: input.safeResultJson as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async startPause(input: {
    readonly providerId: string;
    readonly startedAt: Date;
    readonly endsAt: Date | null;
    readonly expectedVersion: number;
    readonly actorUserId: string;
  }): Promise<
    ProviderTemporaryPauseSnapshot | "PAUSE_CONFLICT" | "VERSION_CONFLICT"
  > {
    try {
      const unresolved = await this.database.providerTemporaryPause.findFirst({
        where: { providerId: input.providerId, resumedAt: null },
        select: { id: true, endsAt: true, version: true },
      });
      if (unresolved !== null) {
        if (
          unresolved.endsAt === null ||
          unresolved.endsAt.getTime() > input.startedAt.getTime()
        ) {
          return "PAUSE_CONFLICT";
        }

        // DEC-057 expiry is effective automatically by time. Materialize the
        // already-expired row's terminal state only when a later start needs
        // the unique unresolved slot; its actual effective end remains
        // `endsAt`, and no approval/lifecycle fact is changed.
        const expired = await this.database.providerTemporaryPause.updateMany({
          where: {
            id: unresolved.id,
            providerId: input.providerId,
            resumedAt: null,
            endsAt: { lte: input.startedAt },
            version: unresolved.version,
          },
          data: {
            resumedAt: unresolved.endsAt,
            version: { increment: 1 },
          },
        });
        if (expired.count === 0) {
          return "VERSION_CONFLICT";
        }
      }
      if (input.expectedVersion !== 0) {
        return "VERSION_CONFLICT";
      }

      const created = await this.database.providerTemporaryPause.create({
        data: {
          providerId: input.providerId,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          resumedAt: null,
          actorUserId: input.actorUserId,
          version: 1,
        },
      });
      return toTemporaryPauseSnapshot(created);
    } catch (error) {
      const mapped = mapPrismaProviderAvailabilityError(error);
      if (
        mapped instanceof ProviderAvailabilityError &&
        mapped.code === "PROVIDER_AVAILABILITY_PAUSE_CONFLICT"
      ) {
        return "PAUSE_CONFLICT";
      }
      rethrowMapped(error);
    }
  }

  public async resumePause(input: {
    readonly providerId: string;
    readonly expectedVersion: number;
    readonly resumedAt: Date;
  }): Promise<
    ProviderTemporaryPauseSnapshot | "NOT_FOUND" | "VERSION_CONFLICT"
  > {
    try {
      const unresolved = await this.database.providerTemporaryPause.findFirst({
        where: { providerId: input.providerId, resumedAt: null },
      });
      if (unresolved === null) {
        return "NOT_FOUND";
      }
      if (unresolved.version !== input.expectedVersion) {
        return "VERSION_CONFLICT";
      }

      const updated = await this.database.providerTemporaryPause.updateMany({
        where: {
          id: unresolved.id,
          providerId: input.providerId,
          resumedAt: null,
          version: input.expectedVersion,
        },
        data: {
          resumedAt: input.resumedAt,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        return "VERSION_CONFLICT";
      }

      const row = await this.database.providerTemporaryPause.findUnique({
        where: { id: unresolved.id },
      });
      if (row === null) {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
          "Pause resume completed without a pause snapshot",
        );
      }
      return toTemporaryPauseSnapshot(row);
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async appendPauseHistory(input: {
    readonly providerId: string;
    readonly targetId: string;
    readonly targetVersion: number;
    readonly eventCode: "pause.started" | "pause.resumed";
    readonly actorUserId: string;
    readonly requestId: string;
    readonly reasonCode?: string;
    readonly safeBefore: ProviderTemporaryPauseSnapshot | null;
    readonly safeAfter: ProviderTemporaryPauseSnapshot;
  }): Promise<void> {
    await this.database.providerAvailabilityHistory.create({
      data: {
        providerId: input.providerId,
        targetType: "PAUSE",
        targetId: input.targetId,
        targetVersion: input.targetVersion,
        eventCode: input.eventCode,
        actorUserId: input.actorUserId,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: input.safeBefore as unknown as Prisma.InputJsonValue,
        safeAfter: input.safeAfter as unknown as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    });
  }
}

export function createPrismaProviderAvailabilityRepository(
  transactionContext: unknown,
): PrismaProviderAvailabilityRepository {
  return new PrismaProviderAvailabilityRepository(
    transactionContext as AvailabilityDatabase,
    createTransactionalProviderIdentityReader(transactionContext),
  );
}

export interface ProviderAvailabilityTransactionContext {
  readonly repository: PrismaProviderAvailabilityRepository;
  readonly localityReader: ReturnType<typeof createTransactionalLocalityReader>;
  readonly countryTimeZoneReader: ProviderAvailabilityCountryTimeZoneReader;
}

/**
 * @desc Build one transaction-bound unit of work: the Providers repository
 * plus Configuration's transaction-bound `LocalityReader`, both sharing the
 * exact same interactive transaction (repair item 2). Coverage validation
 * must never read localities through a separately opened, full-client
 * reader.
 */
function transactionContext(tx: unknown): ProviderAvailabilityTransactionContext {
  return {
    repository: createPrismaProviderAvailabilityRepository(tx),
    localityReader: createTransactionalLocalityReader(tx),
    countryTimeZoneReader: createTransactionalCountryTimeZoneReader(tx),
  };
}

export function withProviderAvailabilityWriteTransaction<T>(
  work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
): Promise<T> {
  const client = getPrismaClient();
  return runProviderAvailabilityWriteTransactionWithClient(client, work);
}

function toWeeklyScheduleSnapshot(row: {
  readonly id: string;
  readonly weekday: number;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly endsNextDay: boolean;
}): ProviderWeeklyScheduleSnapshot {
  return {
    id: row.id,
    weekday: row.weekday as ProviderWeeklyScheduleSnapshot["weekday"],
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    endsNextDay: row.endsNextDay,
  };
}

function localDateFromDatabase(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function localDateToDatabase(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toScheduleExceptionSnapshot(row: {
  readonly id: string;
  readonly localDate: Date;
  readonly closed: boolean;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly endsNextDay: boolean;
}): ProviderScheduleExceptionSnapshot {
  return {
    id: row.id,
    localDate: localDateFromDatabase(row.localDate),
    closed: row.closed,
    startMinute: row.closed ? null : row.startMinute,
    endMinute: row.closed ? null : row.endMinute,
    endsNextDay: row.closed ? null : row.endsNextDay,
  };
}

function toWorkerWeeklyScheduleSnapshot(row: {
  readonly id: string;
  readonly weekday: number;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly endsNextDay: boolean;
}): WorkerWeeklyScheduleSnapshot {
  return {
    id: row.id,
    weekday: row.weekday as WorkerWeeklyScheduleSnapshot["weekday"],
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    endsNextDay: row.endsNextDay,
  };
}

function toWorkerScheduleExceptionSnapshot(row: {
  readonly id: string;
  readonly localDate: Date;
  readonly closed: boolean;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly endsNextDay: boolean;
}): WorkerScheduleExceptionSnapshot {
  return {
    id: row.id,
    localDate: localDateFromDatabase(row.localDate),
    closed: row.closed,
    startMinute: row.closed ? null : row.startMinute,
    endMinute: row.closed ? null : row.endMinute,
    endsNextDay: row.closed ? null : row.endsNextDay,
  };
}

function toTemporaryPauseSnapshot(row: {
  readonly id: string;
  readonly providerId: string;
  readonly startedAt: Date;
  readonly endsAt: Date | null;
  readonly resumedAt: Date | null;
  readonly actorUserId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): ProviderTemporaryPauseSnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    startedAt: row.startedAt,
    endsAt: row.endsAt,
    resumedAt: row.resumedAt,
    actorUserId: row.actorUserId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCapacityRuleSnapshot(row: {
  readonly id: string;
  readonly providerId: string;
  readonly maxSimultaneousTeams: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): ProviderCapacityRuleSnapshot {
  return {
    id: row.id,
    providerId: row.providerId,
    maxSimultaneousTeams: row.maxSimultaneousTeams,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function runProviderAvailabilityWriteTransactionWithClient<T>(
  client: ProviderAvailabilityTransactionClient,
  work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx) => work(transactionContext(tx)),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 30_000,
          timeout: 60_000,
        },
      );
    } catch (error) {
      if (!isProviderAvailabilitySerializationFailure(error)) {
        throw error;
      }
      if (attempt === SERIALIZABLE_WRITE_MAX_ATTEMPTS) {
        throw providerAvailabilitySerializationConflictError();
      }
    }
  }
  throw providerAvailabilitySerializationConflictError();
}

export function withProviderAvailabilityReadTransaction<T>(
  work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
): Promise<T> {
  const client = getPrismaClient();
  return client.$transaction(
    async (tx) => work(transactionContext(tx)),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 30_000,
      timeout: 60_000,
    },
  );
}
