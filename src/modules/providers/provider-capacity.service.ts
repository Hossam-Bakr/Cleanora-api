/**
 * Provider complete-Team capacity service (R1-P10 Batch B2).
 * Protected rule management uses DEC-058 authorization and UUID command
 * replay; interval evaluation reports potential supply only.
 */

import { createHash } from "node:crypto";

import { isUtcIntervalFullyCoveredByCivilAvailability } from "./domain/provider-availability-calendar.js";
import { ProviderAvailabilityError } from "./domain/provider-availability.errors.js";
import { decideProviderAvailabilityManagementAuthorization } from "./domain/provider-availability.policy.js";
import type {
  ProviderAvailabilityAuthorizationReader,
  ProviderAvailabilityCountryTimeZoneReader,
  ProviderCapacityRepository,
} from "./domain/provider-availability.ports.js";
import type {
  ProviderCapacityRuleSnapshot,
  ProviderScheduleExceptionSnapshot,
  ProviderWeeklyScheduleSnapshot,
  WorkerScheduleExceptionSnapshot,
  WorkerWeeklyScheduleSnapshot,
} from "./domain/provider-availability.types.js";
import {
  evaluateCompleteTeamCapacity as evaluateCompleteTeamCapacityPolicy,
  validateMaxSimultaneousTeams,
  type ProviderTeamCapacityResult,
  type ProviderTeamCapacityTeamFact,
} from "./domain/provider-team-capacity.policy.js";
import { isProviderRuntimeUnavailable } from "./domain/provider-temporary-pause.policy.js";
import { intersectProviderWorkerAvailabilityForCivilDate } from "./provider-worker-availability.service.js";

export interface ProviderCapacityCommandMeta {
  readonly actorUserId: string;
  readonly requestId?: string;
}

export interface ProviderCapacityRuleDto {
  readonly providerId: string;
  readonly version: number;
  readonly maxSimultaneousTeams: number | null;
}

export interface ReplaceCapacityRuleInput {
  readonly maxSimultaneousTeams: number;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly reasonCode?: string;
}

export type ProviderCapacityRuntimeBlocker =
  | "CAPACITY_RULE_MISSING"
  | "PROVIDER_COUNTRY_MISSING"
  | "COUNTRY_TIME_ZONE_MISSING"
  | "SUSPENDED"
  | "PAUSE";

export interface ProviderCapacityEvaluationDto {
  readonly providerId: string;
  readonly intervalStart: string;
  readonly intervalEnd: string;
  readonly countryTimeZone: string | null;
  readonly maxSimultaneousTeams: number;
  readonly completeAvailableTeamCount: number;
  readonly availableUnits: number;
  readonly requestedUnits: number | null;
  readonly sufficient: boolean | null;
  readonly blockers: readonly ProviderCapacityRuntimeBlocker[];
  readonly teamResults: ProviderTeamCapacityResult["teams"];
}

export interface ProviderCapacityTransactionContext {
  readonly repository: ProviderCapacityRepository &
    ProviderAvailabilityAuthorizationReader;
  readonly countryTimeZoneReader: ProviderAvailabilityCountryTimeZoneReader;
}

export interface ProviderCapacityServiceDependencies {
  readonly runInWriteTransaction: <T>(
    work: (context: ProviderCapacityTransactionContext) => Promise<T>,
  ) => Promise<T>;
  readonly runInReadTransaction: <T>(
    work: (context: ProviderCapacityTransactionContext) => Promise<T>,
  ) => Promise<T>;
}

function toCapacityRuleDto(
  providerId: string,
  snapshot: ProviderCapacityRuleSnapshot | null,
): ProviderCapacityRuleDto {
  return {
    providerId,
    version: snapshot?.version ?? 0,
    maxSimultaneousTeams: snapshot?.maxSimultaneousTeams ?? null,
  };
}

function fingerprintReplaceCapacityRuleCommand(input: {
  readonly maxSimultaneousTeams: number;
  readonly expectedVersion: number;
  readonly reasonCode?: string;
}): string {
  const canonical = JSON.stringify({
    maxSimultaneousTeams: input.maxSimultaneousTeams,
    expectedVersion: input.expectedVersion,
    reasonCode: input.reasonCode ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function assertValidUtcInterval(start: Date, end: Date): void {
  if (!(start.getTime() < end.getTime())) {
    throw new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
      "Capacity interval must end after it starts",
    );
  }
}

/**
 * @desc Check whether one Worker covers the full UTC request after
 * intersecting Provider and Worker calendars for each local civil date.
 * @algorithm Convert the half-open UTC interval to the Provider country's
 * IANA zone, enumerate every local civil date touched by `[start, end)`, and
 * project the request onto that date's local-minute segment. For each date,
 * reuse `intersectProviderWorkerAvailabilityForCivilDate`, then require the
 * union of intersection intervals to cover that exact segment. End minutes are
 * rounded up when sub-minute seconds exist so a schedule never falsely covers
 * time outside its minute-granular representation. No reservations or Booking
 * reads participate in this potential-supply calculation.
 */
export function isProviderWorkerAvailableForFullUtcInterval(input: {
  readonly timeZone: string;
  readonly intervalStart: Date;
  readonly intervalEnd: Date;
  readonly providerWeeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[];
  readonly providerExceptions: readonly ProviderScheduleExceptionSnapshot[];
  readonly workerWeeklyPeriods: readonly WorkerWeeklyScheduleSnapshot[];
  readonly workerExceptions: readonly WorkerScheduleExceptionSnapshot[];
}): boolean {
  assertValidUtcInterval(input.intervalStart, input.intervalEnd);

  return isUtcIntervalFullyCoveredByCivilAvailability({
    timeZone: input.timeZone,
    intervalStart: input.intervalStart,
    intervalEnd: input.intervalEnd,
    intervalsForCivilDate: (localDate) =>
      intersectProviderWorkerAvailabilityForCivilDate({
        localDate,
        providerWeeklyPeriods: input.providerWeeklyPeriods,
        providerExceptions: input.providerExceptions,
        workerWeeklyPeriods: input.workerWeeklyPeriods,
        workerExceptions: input.workerExceptions,
      }),
  });
}

export class ProviderCapacityService {
  public constructor(private readonly deps: ProviderCapacityServiceDependencies) {}

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

  public async getCapacityRule(
    meta: ProviderCapacityCommandMeta,
    providerId: string,
  ): Promise<ProviderCapacityRuleDto> {
    return this.deps.runInReadTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);
      return toCapacityRuleDto(
        providerId,
        await repository.findCapacityRuleByProviderId(providerId),
      );
    });
  }

  public async replaceCapacityRule(
    meta: ProviderCapacityCommandMeta,
    providerId: string,
    input: ReplaceCapacityRuleInput,
  ): Promise<{
    readonly capacity: ProviderCapacityRuleDto;
    readonly replayed: boolean;
  }> {
    const validationError = validateMaxSimultaneousTeams(
      input.maxSimultaneousTeams,
    );
    if (validationError !== null) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
        `Provider capacity rule is invalid: ${validationError}`,
      );
    }

    return this.deps.runInWriteTransaction(async ({ repository }) => {
      await this.assertManager(repository, providerId, meta.actorUserId);

      const fingerprint = fingerprintReplaceCapacityRuleCommand({
        maxSimultaneousTeams: input.maxSimultaneousTeams,
        expectedVersion: input.expectedVersion,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
      });
      const receipt = await repository.reserveOrReplayCapacityCommand({
        providerId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.actorUserId,
      });
      if (receipt.status === "REPLAYED") {
        if (receipt.safeResultJson === null || receipt.safeResultJson === undefined) {
          throw new ProviderAvailabilityError(
            "PROVIDER_AVAILABILITY_DEPENDENCY_FAILED",
            "Capacity idempotent replay target is missing",
          );
        }
        return {
          capacity: receipt.safeResultJson as unknown as ProviderCapacityRuleDto,
          replayed: true,
        };
      }

      const before = await repository.findCapacityRuleByProviderId(providerId);
      const result = await repository.replaceCapacityRule({
        providerId,
        expectedVersion: input.expectedVersion,
        maxSimultaneousTeams: input.maxSimultaneousTeams,
      });
      if (result === "VERSION_CONFLICT") {
        throw new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
        );
      }

      await repository.appendCapacityHistory({
        providerId,
        targetId: result.id,
        targetVersion: result.version,
        actorUserId: meta.actorUserId,
        requestId: meta.requestId ?? input.idempotencyKey,
        ...(input.reasonCode === undefined ? {} : { reasonCode: input.reasonCode }),
        safeBefore: before,
        safeAfter: result,
      });

      const dto = toCapacityRuleDto(providerId, result);
      await repository.completeCapacityCommand({
        providerId,
        idempotencyKey: input.idempotencyKey,
        safeResultJson: dto,
      });

      return { capacity: dto, replayed: false };
    });
  }

  public async evaluateCompleteTeamCapacity(input: {
    readonly providerId: string;
    readonly intervalStart: Date;
    readonly intervalEnd: Date;
    readonly requestedUnits?: number;
    readonly at?: Date;
  }): Promise<ProviderCapacityEvaluationDto> {
    assertValidUtcInterval(input.intervalStart, input.intervalEnd);
    if (
      input.requestedUnits !== undefined &&
      (!Number.isInteger(input.requestedUnits) || input.requestedUnits < 1)
    ) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
        "requestedUnits must be a positive integer",
      );
    }

    return this.deps.runInReadTransaction(
      async ({ repository, countryTimeZoneReader }) => {
        const facts = await repository.findCapacityEvaluationFacts(
          input.providerId,
        );
        if (facts === null) {
          throw new ProviderAvailabilityError("PROVIDER_AVAILABILITY_NOT_FOUND");
        }

        const missingRuleResult = this.zeroCapacityResult(input, null, 0, [
          "CAPACITY_RULE_MISSING",
        ]);
        if (facts.capacityRule === null) {
          return missingRuleResult;
        }

        const maxSimultaneousTeams = facts.capacityRule.maxSimultaneousTeams;
        if (facts.providerCountryId === null) {
          return this.zeroCapacityResult(input, null, maxSimultaneousTeams, [
            "PROVIDER_COUNTRY_MISSING",
          ]);
        }

        const countryTimeZone =
          await countryTimeZoneReader.getTimeZoneForCountry(
            facts.providerCountryId,
          );
        if (countryTimeZone === null) {
          return this.zeroCapacityResult(input, null, maxSimultaneousTeams, [
            "COUNTRY_TIME_ZONE_MISSING",
          ]);
        }

        const runtimeUnavailable = isProviderRuntimeUnavailable({
          operationalStatus: facts.operationalStatus,
          pause: facts.pause,
          at: input.at ?? new Date(),
          interval: { start: input.intervalStart, end: input.intervalEnd },
        });
        if (runtimeUnavailable) {
          return this.zeroCapacityResult(
            input,
            countryTimeZone,
            maxSimultaneousTeams,
            [facts.operationalStatus === "SUSPENDED" ? "SUSPENDED" : "PAUSE"],
          );
        }

        const policyInputTeams: ProviderTeamCapacityTeamFact[] = facts.teams.map(
          (team) => ({
            teamId: team.teamId,
            status: team.status,
            members: team.members.map((member) => ({
              workerId: member.workerId,
              cleans: member.cleans,
              workerStatus: member.workerStatus,
              availableForFullInterval:
                member.workerStatus === "ACTIVE" &&
                isProviderWorkerAvailableForFullUtcInterval({
                  timeZone: countryTimeZone,
                  intervalStart: input.intervalStart,
                  intervalEnd: input.intervalEnd,
                  providerWeeklyPeriods: facts.providerWeeklyPeriods,
                  providerExceptions: facts.providerExceptions,
                  workerWeeklyPeriods: member.weeklyPeriods,
                  workerExceptions: member.exceptions,
                }),
            })),
          }),
        );
        const policyResult = evaluateCompleteTeamCapacityPolicy({
          maxSimultaneousTeams,
          teams: policyInputTeams,
        });

        return {
          providerId: input.providerId,
          intervalStart: input.intervalStart.toISOString(),
          intervalEnd: input.intervalEnd.toISOString(),
          countryTimeZone,
          maxSimultaneousTeams,
          completeAvailableTeamCount: policyResult.completeAvailableTeamCount,
          availableUnits: policyResult.availableUnits,
          requestedUnits: input.requestedUnits ?? null,
          sufficient:
            input.requestedUnits === undefined
              ? null
              : policyResult.availableUnits >= input.requestedUnits,
          blockers: [],
          teamResults: policyResult.teams,
        };
      },
    );
  }

  private zeroCapacityResult(
    input: {
      readonly providerId: string;
      readonly intervalStart: Date;
      readonly intervalEnd: Date;
      readonly requestedUnits?: number;
    },
    countryTimeZone: string | null,
    maxSimultaneousTeams: number,
    blockers: readonly ProviderCapacityRuntimeBlocker[],
  ): ProviderCapacityEvaluationDto {
    return {
      providerId: input.providerId,
      intervalStart: input.intervalStart.toISOString(),
      intervalEnd: input.intervalEnd.toISOString(),
      countryTimeZone,
      maxSimultaneousTeams,
      completeAvailableTeamCount: 0,
      availableUnits: 0,
      requestedUnits: input.requestedUnits ?? null,
      sufficient: input.requestedUnits === undefined ? null : false,
      blockers,
      teamResults: [],
    };
  }
}
