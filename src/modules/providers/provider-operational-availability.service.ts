import {
  availabilityIntervalsForCivilDate,
  isUtcIntervalFullyCoveredByCivilAvailability,
  splitWeeklyPeriod,
} from "./domain/provider-availability-calendar.js";
import { ProviderAvailabilityError } from "./domain/provider-availability.errors.js";
import { matchesProviderCoverage } from "./domain/provider-availability.policy.js";
import type {
  ProviderAvailabilityCountryTimeZoneReader,
  ProviderAvailabilityLocalityReader,
  ProviderCapacityEvaluationFacts,
  ProviderOperationalAvailabilityRepository,
} from "./domain/provider-availability.ports.js";
import type {
  ProviderScheduleExceptionSnapshot,
  ProviderWeeklyScheduleSnapshot,
  WorkerWeeklyScheduleSnapshot,
} from "./domain/provider-availability.types.js";
import { evaluateCompleteTeamCapacity as evaluateCompleteTeamCapacityPolicy } from "./domain/provider-team-capacity.policy.js";
import { isProviderRuntimeUnavailable } from "./domain/provider-temporary-pause.policy.js";
import { isProviderWorkerAvailableForFullUtcInterval } from "./provider-capacity.service.js";
import type {
  ProviderOperationalAvailabilityBlockerCode,
  ProviderOperationalAvailabilityEvaluation,
  ProviderOperationalAvailabilityReader,
} from "./providers.public.js";

type TransactionContext = {
  readonly repository: ProviderOperationalAvailabilityRepository;
  readonly localityReader: ProviderAvailabilityLocalityReader;
  readonly countryTimeZoneReader: ProviderAvailabilityCountryTimeZoneReader;
};

export interface ProviderOperationalAvailabilityServiceDependencies {
  readonly runInReadTransaction: <T>(
    work: (context: TransactionContext) => Promise<T>,
  ) => Promise<T>;
}

export interface ProviderAvailabilityReadinessFacts {
  readonly providerId: string;
  readonly coverageReady: {
    readonly satisfied: boolean;
    readonly blockerCodes: readonly string[];
  };
  readonly availabilityReady: {
    readonly satisfied: boolean;
    readonly blockerCodes: readonly string[];
  };
  readonly capacityReady: {
    readonly satisfied: boolean;
    readonly blockerCodes: readonly string[];
  };
}

type ResolvedTextualArea = {
  readonly active: boolean;
  readonly countryId: string | null;
  readonly cityId: string | null;
  readonly districtId: string | null;
  readonly districtIdsForMatching: readonly string[];
};

function parseUtcInstant(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
      `${field} must be an ISO-8601 UTC instant`,
    );
  }
  return parsed;
}

function assertValidEvaluationInput(input: {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly requiredCompleteTeamUnits: number;
}): { readonly startsAt: Date; readonly endsAt: Date } {
  const startsAt = parseUtcInstant(input.startsAt, "utcInterval.startsAt");
  const endsAt = parseUtcInstant(input.endsAt, "utcInterval.endsAt");
  if (!(startsAt.getTime() < endsAt.getTime())) {
    throw new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
      "utcInterval.endsAt must be after utcInterval.startsAt",
    );
  }
  if (
    !Number.isInteger(input.requiredCompleteTeamUnits) ||
    input.requiredCompleteTeamUnits < 1
  ) {
    throw new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
      "requiredCompleteTeamUnits must be a positive integer",
    );
  }
  return { startsAt, endsAt };
}

function isProviderScheduleAvailableForFullUtcInterval(input: {
  readonly timeZone: string;
  readonly intervalStart: Date;
  readonly intervalEnd: Date;
  readonly weeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[];
  readonly exceptions: readonly ProviderScheduleExceptionSnapshot[];
}): boolean {
  return isUtcIntervalFullyCoveredByCivilAvailability({
    timeZone: input.timeZone,
    intervalStart: input.intervalStart,
    intervalEnd: input.intervalEnd,
    intervalsForCivilDate: (localDate) =>
      availabilityIntervalsForCivilDate({
        localDate,
        weeklyPeriods: input.weeklyPeriods,
        exceptions: input.exceptions,
      }),
  });
}

function hasWeeklyOverlap(
  providerWeeklyPeriods: readonly ProviderWeeklyScheduleSnapshot[],
  workerWeeklyPeriods: readonly WorkerWeeklyScheduleSnapshot[],
): boolean {
  const providerSegments = providerWeeklyPeriods.flatMap((period) =>
    splitWeeklyPeriod(period),
  );
  const workerSegments = workerWeeklyPeriods.flatMap((period) =>
    splitWeeklyPeriod(period),
  );
  return providerSegments.some((provider) =>
    workerSegments.some(
      (worker) =>
        worker.weekday === provider.weekday &&
        Math.max(worker.startMinute, provider.startMinute) <
          Math.min(worker.endMinute, provider.endMinute),
    ),
  );
}

function appendUnique(
  target: ProviderOperationalAvailabilityBlockerCode[],
  code: ProviderOperationalAvailabilityBlockerCode,
): void {
  if (!target.includes(code)) target.push(code);
}

export class ProviderOperationalAvailabilityService
  implements ProviderOperationalAvailabilityReader
{
  public constructor(
    private readonly deps: ProviderOperationalAvailabilityServiceDependencies,
  ) {}

  public async findCandidateProviderIdsForActiveTextualArea(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
  }): Promise<readonly string[]> {
    return this.deps.runInReadTransaction(
      async ({ repository, localityReader }) => {
        const area = await this.resolveTextualArea(localityReader, {
          location: input,
        });
        if (!area.active || area.countryId !== input.countryId) {
          return [];
        }
        return repository.findCandidateProviderIdsForActiveTextualArea({
          countryId: input.countryId,
          cityId: input.cityId,
          districtIds: area.districtIdsForMatching,
        });
      },
    );
  }

  public async evaluateOneProviderOperationalAvailability(input: {
    readonly providerId: string;
    readonly districtId?: string;
    readonly location?: {
      readonly countryId: string;
      readonly cityId: string;
      readonly districtId?: string;
    };
    readonly utcInterval: {
      readonly startsAt: string;
      readonly endsAt: string;
    };
    readonly requiredCompleteTeamUnits: number;
  }): Promise<ProviderOperationalAvailabilityEvaluation | null> {
    const interval = assertValidEvaluationInput({
      startsAt: input.utcInterval.startsAt,
      endsAt: input.utcInterval.endsAt,
      requiredCompleteTeamUnits: input.requiredCompleteTeamUnits,
    });

    return this.deps.runInReadTransaction(
      async ({ repository, localityReader, countryTimeZoneReader }) => {
        const facts = await repository.findCapacityEvaluationFacts(input.providerId);
        if (facts === null || facts.applicationStatus !== "APPROVED") {
          return null;
        }
        const configuration = await repository.findConfigurationByProviderId(
          input.providerId,
        );
        const area = await this.resolveTextualArea(localityReader, {
          ...(input.districtId === undefined
            ? {}
            : { districtId: input.districtId }),
          ...(input.location === undefined ? {} : { location: input.location }),
        });
        const timeZone =
          facts.providerCountryId === null
            ? null
            : await countryTimeZoneReader.getTimeZoneForCountry(
                facts.providerCountryId,
              );

        const coverageMatch = this.coverageMatch(
          configuration?.coverage ?? [],
          area,
          facts.providerCountryId,
        );
        const runtimeBlocked = isProviderRuntimeUnavailable({
          operationalStatus: facts.operationalStatus,
          pause: facts.pause,
          at: new Date(),
          interval: { start: interval.startsAt, end: interval.endsAt },
        });
        const providerScheduleAvailable =
          timeZone !== null &&
          isProviderScheduleAvailableForFullUtcInterval({
            timeZone,
            intervalStart: interval.startsAt,
            intervalEnd: interval.endsAt,
            weeklyPeriods: facts.providerWeeklyPeriods,
            exceptions: facts.providerExceptions,
          });
        const capacity = this.evaluateCapacityFromFacts({
          facts,
          timeZone,
          intervalStart: interval.startsAt,
          intervalEnd: interval.endsAt,
          requestedUnits: input.requiredCompleteTeamUnits,
          runtimeBlocked,
        });

        const blockerCodes: ProviderOperationalAvailabilityBlockerCode[] = [];
        if (!area.active) {
          appendUnique(blockerCodes, "TEXTUAL_AREA_INACTIVE_OR_MISMATCH");
        } else if (!coverageMatch.matched) {
          appendUnique(blockerCodes, "PROVIDER_COVERAGE_MISMATCH");
        }
        if (facts.operationalStatus !== "LIVE") {
          appendUnique(
            blockerCodes,
            facts.operationalStatus === "SUSPENDED"
              ? "SUSPENDED"
              : "PROVIDER_NOT_LIVE",
          );
        }
        if (
          facts.pause !== null &&
          isProviderRuntimeUnavailable({
            operationalStatus: "LIVE",
            pause: facts.pause,
            at: new Date(),
            interval: { start: interval.startsAt, end: interval.endsAt },
          })
        ) {
          appendUnique(blockerCodes, "PAUSE");
        }
        if (!providerScheduleAvailable) {
          appendUnique(blockerCodes, "PROVIDER_SCHEDULE_CLOSED");
        }
        for (const blocker of capacity.blockers) {
          appendUnique(blockerCodes, blocker);
        }
        if (capacity.availableUnits === 0 && capacity.blockers.length === 0) {
          appendUnique(blockerCodes, "WORKER_TEAM_UNAVAILABLE");
        }
        if (capacity.sufficient === false) {
          appendUnique(blockerCodes, "INSUFFICIENT_TEAM_UNITS");
        }

        const available =
          coverageMatch.matched &&
          facts.operationalStatus === "LIVE" &&
          !runtimeBlocked &&
          providerScheduleAvailable &&
          capacity.sufficient === true;

        return {
          providerId: input.providerId,
          timeZone,
          coverageMatch: {
            matched: coverageMatch.matched,
            countryId: area.countryId,
            cityId: area.cityId,
            districtId: area.districtId,
            matchedBy: coverageMatch.matchedBy,
          },
          availability: {
            available,
            runtimeAvailable: facts.operationalStatus === "LIVE" && !runtimeBlocked,
            providerScheduleAvailable,
          },
          capacity: {
            availableUnits: capacity.availableUnits,
            requiredCompleteTeamUnits: input.requiredCompleteTeamUnits,
            sufficient: capacity.sufficient === true,
          },
          blockerCodes,
          versions: {
            availability: configuration?.version ?? 0,
            workforce: facts.workforceStateVersion,
            capacity: facts.capacityRule?.version ?? 0,
          },
        };
      },
    );
  }

  public async getProviderAvailabilityReadiness(
    providerId: string,
  ): Promise<ProviderAvailabilityReadinessFacts | null> {
    return this.deps.runInReadTransaction(
      async ({ repository, localityReader }) => {
        const [configuration, facts] = await Promise.all([
          repository.findConfigurationByProviderId(providerId),
          repository.findCapacityEvaluationFacts(providerId),
        ]);
        if (facts === null || facts.applicationStatus !== "APPROVED") {
          return null;
        }

        const coverageReady =
          configuration !== null &&
          (await this.hasEffectiveActiveCoverage(
            localityReader,
            configuration.coverage,
            facts.providerCountryId,
          ));
        const availabilityReady =
          configuration !== null && configuration.weeklyPeriods.length > 0;
        const hasPositiveCapacityRule =
          facts.capacityRule !== null &&
          facts.capacityRule.maxSimultaneousTeams > 0;
        const hasCompleteRecurringTeam =
          hasPositiveCapacityRule &&
          facts.providerWeeklyPeriods.length > 0 &&
          facts.teams.some(
            (team) =>
              team.status === "ACTIVE" &&
              team.members.length > 0 &&
              team.members.some((member) => member.cleans) &&
              team.members.every(
                (member) =>
                  member.workerStatus === "ACTIVE" &&
                  hasWeeklyOverlap(
                    facts.providerWeeklyPeriods,
                    member.weeklyPeriods,
                  ),
              ),
          );

        return {
          providerId,
          coverageReady: {
            satisfied: coverageReady,
            blockerCodes: coverageReady
              ? []
              : ["NO_EFFECTIVE_ACTIVE_COVERAGE_SELECTION"],
          },
          availabilityReady: {
            satisfied: availabilityReady,
            blockerCodes: availabilityReady
              ? []
              : ["NO_VALID_PROVIDER_WEEKLY_PERIOD"],
          },
          capacityReady: {
            satisfied: hasPositiveCapacityRule && hasCompleteRecurringTeam,
            blockerCodes:
              hasPositiveCapacityRule && hasCompleteRecurringTeam
                ? []
                : [
                    ...(hasPositiveCapacityRule
                      ? []
                      : ["POSITIVE_SIMULTANEOUS_TEAM_LIMIT_REQUIRED"]),
                    ...(hasCompleteRecurringTeam
                      ? []
                      : [
                          "NO_COMPLETE_TEAM_WITH_RECURRING_PROVIDER_WORKER_OVERLAP",
                        ]),
                  ],
          },
        };
      },
    );
  }

  private evaluateCapacityFromFacts(input: {
    readonly facts: ProviderCapacityEvaluationFacts;
    readonly timeZone: string | null;
    readonly intervalStart: Date;
    readonly intervalEnd: Date;
    readonly requestedUnits: number;
    readonly runtimeBlocked: boolean;
  }): {
    readonly availableUnits: number;
    readonly sufficient: boolean;
    readonly blockers: readonly ProviderOperationalAvailabilityBlockerCode[];
  } {
    if (input.facts.capacityRule === null) {
      return { availableUnits: 0, sufficient: false, blockers: ["CAPACITY_RULE_MISSING"] };
    }
    if (input.facts.providerCountryId === null) {
      return {
        availableUnits: 0,
        sufficient: false,
        blockers: ["PROVIDER_COUNTRY_MISSING"],
      };
    }
    if (input.timeZone === null) {
      return {
        availableUnits: 0,
        sufficient: false,
        blockers: ["COUNTRY_TIME_ZONE_MISSING"],
      };
    }
    if (input.runtimeBlocked) {
      return {
        availableUnits: 0,
        sufficient: false,
        blockers: [
          input.facts.operationalStatus === "SUSPENDED" ? "SUSPENDED" : "PAUSE",
        ],
      };
    }

    const policyResult = evaluateCompleteTeamCapacityPolicy({
      maxSimultaneousTeams: input.facts.capacityRule.maxSimultaneousTeams,
      teams: input.facts.teams.map((team) => ({
        teamId: team.teamId,
        status: team.status,
        members: team.members.map((member) => ({
          workerId: member.workerId,
          cleans: member.cleans,
          workerStatus: member.workerStatus,
          availableForFullInterval:
            member.workerStatus === "ACTIVE" &&
            isProviderWorkerAvailableForFullUtcInterval({
              timeZone: input.timeZone as string,
              intervalStart: input.intervalStart,
              intervalEnd: input.intervalEnd,
              providerWeeklyPeriods: input.facts.providerWeeklyPeriods,
              providerExceptions: input.facts.providerExceptions,
              workerWeeklyPeriods: member.weeklyPeriods,
              workerExceptions: member.exceptions,
            }),
        })),
      })),
    });

    return {
      availableUnits: policyResult.availableUnits,
      sufficient: policyResult.availableUnits >= input.requestedUnits,
      blockers: [],
    };
  }

  private async resolveTextualArea(
    localityReader: ProviderAvailabilityLocalityReader,
    input: {
      readonly districtId?: string;
      readonly location?: {
        readonly countryId: string;
        readonly cityId: string;
        readonly districtId?: string;
      };
    },
  ): Promise<ResolvedTextualArea> {
    const districtId = input.location?.districtId ?? input.districtId;
    if (districtId !== undefined) {
      const district = await localityReader.findDistrictById(districtId);
      if (
        district === null ||
        (input.location !== undefined &&
          (district.cityId !== input.location.cityId ||
            district.countryId !== input.location.countryId)) ||
        !district.isActive ||
        !district.cityActive ||
        !district.countryActive
      ) {
        return {
          active: false,
          countryId: input.location?.countryId ?? null,
          cityId: input.location?.cityId ?? null,
          districtId,
          districtIdsForMatching: [],
        };
      }
      return {
        active: true,
        countryId: district.countryId,
        cityId: district.cityId,
        districtId: district.id,
        districtIdsForMatching: [district.id],
      };
    }

    if (input.location !== undefined) {
      const city = await localityReader.findCityById(input.location.cityId);
      if (
        city === null ||
        city.countryId !== input.location.countryId ||
        !city.isActive ||
        !city.countryActive
      ) {
        return {
          active: false,
          countryId: input.location.countryId,
          cityId: input.location.cityId,
          districtId: null,
          districtIdsForMatching: [],
        };
      }
      return {
        active: true,
        countryId: city.countryId,
        cityId: city.id,
        districtId: null,
        // A district selection does not imply whole-city coverage. City-only
        // input therefore matches only an explicit city selection; the
        // reverse direction (city selection -> district) is handled above.
        districtIdsForMatching: [],
      };
    }

    return {
      active: false,
      countryId: null,
      cityId: null,
      districtId: null,
      districtIdsForMatching: [],
    };
  }

  private coverageMatch(
    coverage: readonly {
      readonly type: "CITY" | "DISTRICT";
      readonly cityId: string | null;
      readonly districtId: string | null;
    }[],
    area: ResolvedTextualArea,
    providerCountryId: string | null,
  ): { readonly matched: boolean; readonly matchedBy: "CITY" | "DISTRICT" | null } {
    if (
      !area.active ||
      area.cityId === null ||
      providerCountryId === null ||
      area.countryId !== providerCountryId
    ) {
      return { matched: false, matchedBy: null };
    }
    const coverageCityIds = coverage
      .filter((entry) => entry.type === "CITY")
      .map((entry) => entry.cityId)
      .filter((id): id is string => id !== null);
    const coverageDistrictIds = coverage
      .filter((entry) => entry.type === "DISTRICT")
      .map((entry) => entry.districtId)
      .filter((id): id is string => id !== null);

    if (area.districtId !== null) {
      const matched = matchesProviderCoverage(
        { coverageCityIds, coverageDistrictIds },
        {
          districtId: area.districtId,
          cityId: area.cityId,
          districtActive: true,
          cityActive: true,
          countryActive: true,
        },
      );
      return {
        matched,
        matchedBy: !matched
          ? null
          : coverageDistrictIds.includes(area.districtId)
            ? "DISTRICT"
            : "CITY",
      };
    }

    if (coverageCityIds.includes(area.cityId)) {
      return { matched: true, matchedBy: "CITY" };
    }
    if (
      area.districtIdsForMatching.some((districtId) =>
        coverageDistrictIds.includes(districtId),
      )
    ) {
      return { matched: true, matchedBy: "DISTRICT" };
    }
    return { matched: false, matchedBy: null };
  }

  private async hasEffectiveActiveCoverage(
    localityReader: ProviderAvailabilityLocalityReader,
    coverage: readonly {
      readonly type: "CITY" | "DISTRICT";
      readonly cityId: string | null;
      readonly districtId: string | null;
    }[],
    providerCountryId: string | null,
  ): Promise<boolean> {
    if (providerCountryId === null) {
      return false;
    }
    for (const area of coverage) {
      if (area.type === "CITY" && area.cityId !== null) {
        const city = await localityReader.findCityById(area.cityId);
        if (
          city?.isActive === true &&
          city.countryActive &&
          city.countryId === providerCountryId
        ) {
          return true;
        }
      }
      if (area.type === "DISTRICT" && area.districtId !== null) {
        const district = await localityReader.findDistrictById(area.districtId);
        if (
          district?.isActive === true &&
          district.cityActive &&
          district.countryActive &&
          district.countryId === providerCountryId
        ) {
          return true;
        }
      }
    }
    return false;
  }
}
