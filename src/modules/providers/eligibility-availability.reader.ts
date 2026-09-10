/**
 * Eligibility operational availability projection (R1-P11 / DEC-084).
 *
 * Extends P10 capacity facts with Team budget OVERFLOW, MISSING_CONFIGURATION
 * variants, and aggregate gender/escort facts (no Worker IDs at boundary).
 */

import {
  createTransactionalCountryTimeZoneReader,
  createTransactionalLocalityReader,
} from "#modules/configuration/configuration.public";

import {
  availabilityIntervalsForCivilDate,
  isUtcIntervalFullyCoveredByCivilAvailability,
} from "./domain/provider-availability-calendar.js";
import { ProviderAvailabilityError } from "./domain/provider-availability.errors.js";
import { matchesProviderCoverage } from "./domain/provider-availability.policy.js";
import type {
  ProviderAvailabilityCountryTimeZoneReader,
  ProviderAvailabilityLocalityReader,
  ProviderCapacityEvaluationFacts,
  ProviderOperationalAvailabilityRepository,
} from "./domain/provider-availability.ports.js";
import { isProviderRuntimeUnavailable } from "./domain/provider-temporary-pause.policy.js";
import { createPrismaProviderAvailabilityRepository } from "./infrastructure/prisma-provider-availability.repository.js";
import { isProviderWorkerAvailableForFullUtcInterval } from "./provider-capacity.service.js";
import type {
  EligibilityAvailabilityReader,
  EligibilityMissingConfigurationKind,
  EligibilityProviderAvailabilityFacts,
  EligibilityTeamAvailabilityFacts,
} from "./providers.public.js";

type TransactionContext = {
  readonly repository: ProviderOperationalAvailabilityRepository;
  readonly localityReader: ProviderAvailabilityLocalityReader;
  readonly countryTimeZoneReader: ProviderAvailabilityCountryTimeZoneReader;
};

export interface EligibilityAvailabilityReaderDependencies {
  readonly runInReadTransaction: <T>(
    work: (context: TransactionContext) => Promise<T>,
  ) => Promise<T>;
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

function isProviderScheduleAvailableForFullUtcInterval(input: {
  readonly timeZone: string;
  readonly intervalStart: Date;
  readonly intervalEnd: Date;
  readonly weeklyPeriods: ProviderCapacityEvaluationFacts["providerWeeklyPeriods"];
  readonly exceptions: ProviderCapacityEvaluationFacts["providerExceptions"];
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

/**
 * @desc Map capacity Team facts to Eligibility aggregates (no Worker IDs).
 * @access Domain helper
 * @explanation Escort is not universally required (DEC-084). When none is
 * required and none present, escort checks are vacuously satisfied.
 */
export function mapTeamAvailabilityFacts(input: {
  readonly facts: ProviderCapacityEvaluationFacts;
  readonly timeZone: string | null;
  readonly intervalStart: Date;
  readonly intervalEnd: Date;
  readonly teams: ProviderCapacityEvaluationFacts["teams"];
}): readonly EligibilityTeamAvailabilityFacts[] {
  return input.teams.map((team) => {
    const membersWithAvailability = team.members.map((member) => {
      const availableForFullInterval =
        input.timeZone !== null &&
        member.workerStatus === "ACTIVE" &&
        isProviderWorkerAvailableForFullUtcInterval({
          timeZone: input.timeZone,
          intervalStart: input.intervalStart,
          intervalEnd: input.intervalEnd,
          providerWeeklyPeriods: input.facts.providerWeeklyPeriods,
          providerExceptions: input.facts.providerExceptions,
          workerWeeklyPeriods: member.weeklyPeriods,
          workerExceptions: member.exceptions,
        });
      return { ...member, availableForFullInterval };
    });

    const cleaners = membersWithAvailability.filter((member) => member.cleans);
    const escorts = membersWithAvailability.filter(
      (member) => member.workerType === "ESCORT" || !member.cleans,
    );
    // Escort-typed workers only for escortFacts; cleans=false OTHER is not escort.
    const escortMembers = membersWithAvailability.filter(
      (member) => member.workerType === "ESCORT",
    );

    const cleanerGenderCounts = {
      male: cleaners.filter((member) => member.gender === "male").length,
      female: cleaners.filter((member) => member.gender === "female").length,
      otherOrUnspecified: cleaners.filter(
        (member) => member.gender === "other_or_unspecified",
      ).length,
    };

    const structurallyValid =
      team.status === "ACTIVE" &&
      membersWithAvailability.length > 0 &&
      cleaners.length > 0 &&
      membersWithAvailability.every((member) => member.workerStatus === "ACTIVE");

    const membersAvailableForWholeInterval =
      structurallyValid &&
      membersWithAvailability.every((member) => member.availableForFullInterval);

    // Providers V1: escort not universally required (DEC-084).
    const escortRequired = false;
    const escortPresentAndValid =
      escortMembers.length === 0
        ? true
        : escortMembers.every((member) => member.workerStatus === "ACTIVE");
    const escortsAvailableForWholeInterval =
      escortMembers.length === 0
        ? true
        : escortMembers.every(
            (member) =>
              member.workerStatus === "ACTIVE" && member.availableForFullInterval,
          );

    // Silence unused — escorts var documents cleans=false non-escort members.
    void escorts;

    return {
      teamId: team.teamId,
      structurallyValid,
      membersAvailableForWholeInterval,
      cleanerGenderCounts,
      escortFacts: {
        escortRequired,
        escortPresentAndValid,
        escortsAvailableForWholeInterval,
      },
    };
  });
}

/**
 * @desc Eligibility availability reader with Team budget + missing-config.
 * @access Application / public projection
 */
export class EligibilityAvailabilityReaderService
  implements EligibilityAvailabilityReader
{
  public constructor(
    private readonly deps: EligibilityAvailabilityReaderDependencies,
  ) {}

  public async discoverProviderIds(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly limit: number;
  }): Promise<
    | { readonly status: "OK"; readonly providerIds: readonly string[] }
    | { readonly status: "OVERFLOW" }
  > {
    return this.deps.runInReadTransaction(
      async ({ repository, localityReader }) => {
        const area = await this.resolveTextualArea(localityReader, {
          location: {
            countryId: input.countryId,
            cityId: input.cityId,
            ...(input.districtId === undefined
              ? {}
              : { districtId: input.districtId }),
          },
        });
        if (!area.active || area.countryId !== input.countryId) {
          return { status: "OK", providerIds: [] };
        }
        const ids = await repository.findCandidateProviderIdsForActiveTextualArea(
          {
            countryId: input.countryId,
            cityId: input.cityId,
            districtIds: area.districtIdsForMatching,
          },
        );
        if (ids.length > input.limit) {
          return { status: "OVERFLOW" };
        }
        return { status: "OK", providerIds: ids };
      },
    );
  }

  public async getAvailabilityFacts(input: {
    readonly providerId: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly remainingTeamBudget: number;
  }): Promise<EligibilityProviderAvailabilityFacts> {
    const startsAt = parseUtcInstant(input.startsAt, "startsAt");
    const endsAt = parseUtcInstant(input.endsAt, "endsAt");
    if (!(startsAt.getTime() < endsAt.getTime())) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
        "endsAt must be after startsAt",
      );
    }
    if (
      !Number.isInteger(input.remainingTeamBudget) ||
      input.remainingTeamBudget < 0
    ) {
      throw new ProviderAvailabilityError(
        "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
        "remainingTeamBudget must be a non-negative integer",
      );
    }

    return this.deps.runInReadTransaction(
      async ({ repository, localityReader, countryTimeZoneReader }) => {
        const facts = await repository.findCapacityEvaluationFacts(
          input.providerId,
          { remainingTeamBudget: input.remainingTeamBudget },
        );
        if (facts === null) {
          return {
            status: "MISSING_CONFIGURATION",
            providerId: input.providerId,
            missingConfiguration: ["COVERAGE", "PROVIDER_SCHEDULE", "CAPACITY_RULE"],
            coverageMatch: false,
            providerScheduleAvailable: false,
            paused: false,
            suspended: false,
            simultaneousTeamLimit: null,
            teams: [],
          };
        }

        if (facts.teamBudgetExceeded === true) {
          return {
            status: "OVERFLOW",
            providerId: input.providerId,
            acceptedTeams: facts.teams.map((team) => ({
              teamId: team.teamId,
              structurallyValid: false,
              membersAvailableForWholeInterval: false,
              cleanerGenderCounts: {
                male: 0,
                female: 0,
                otherOrUnspecified: 0,
              },
              escortFacts: {
                escortRequired: false,
                escortPresentAndValid: true,
                escortsAvailableForWholeInterval: true,
              },
            })),
          };
        }

        const configuration = await repository.findConfigurationByProviderId(
          input.providerId,
        );
        const area = await this.resolveTextualArea(localityReader, {
          location: {
            countryId: input.countryId,
            cityId: input.cityId,
            ...(input.districtId === undefined
              ? {}
              : { districtId: input.districtId }),
          },
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

        // Combined runtime block (suspend OR overlapping pause) is reserved for
        // capacity-style short-circuits; paused DTO stays pause-only.
        const runtimeBlocked = isProviderRuntimeUnavailable({
          operationalStatus: facts.operationalStatus,
          pause: facts.pause,
          at: new Date(),
          interval: { start: startsAt, end: endsAt },
        });
        const paused =
          facts.pause !== null &&
          isProviderRuntimeUnavailable({
            operationalStatus: "LIVE",
            pause: facts.pause,
            at: new Date(),
            interval: { start: startsAt, end: endsAt },
          });
        const suspended = facts.operationalStatus === "SUSPENDED";

        const providerScheduleAvailable =
          timeZone !== null &&
          configuration !== null &&
          configuration.weeklyPeriods.length > 0 &&
          isProviderScheduleAvailableForFullUtcInterval({
            timeZone,
            intervalStart: startsAt,
            intervalEnd: endsAt,
            weeklyPeriods: facts.providerWeeklyPeriods,
            exceptions: facts.providerExceptions,
          });

        const sortedTeams = [...facts.teams].sort((left, right) =>
          left.teamId.localeCompare(right.teamId),
        );
        if (sortedTeams.length > input.remainingTeamBudget) {
          const accepted = sortedTeams.slice(0, input.remainingTeamBudget);
          return {
            status: "OVERFLOW",
            providerId: input.providerId,
            acceptedTeams: mapTeamAvailabilityFacts({
              facts,
              timeZone,
              intervalStart: startsAt,
              intervalEnd: endsAt,
              teams: accepted,
            }),
          };
        }

        // Capacity evaluation may consult runtimeBlocked; paused/suspended DTO
        // fields remain independent facts (never OR suspended into paused).
        void runtimeBlocked;

        const teams = mapTeamAvailabilityFacts({
          facts,
          timeZone,
          intervalStart: startsAt,
          intervalEnd: endsAt,
          teams: sortedTeams,
        });

        const missingConfiguration: EligibilityMissingConfigurationKind[] = [];
        if (configuration === null || (configuration.coverage?.length ?? 0) === 0) {
          missingConfiguration.push("COVERAGE");
        }
        if (
          configuration === null ||
          configuration.weeklyPeriods.length === 0 ||
          timeZone === null
        ) {
          missingConfiguration.push("PROVIDER_SCHEDULE");
        }
        if (
          facts.capacityRule === null ||
          facts.capacityRule.maxSimultaneousTeams < 1
        ) {
          missingConfiguration.push("CAPACITY_RULE");
        }

        const simultaneousTeamLimit =
          facts.capacityRule === null ||
          facts.capacityRule.maxSimultaneousTeams < 1
            ? null
            : facts.capacityRule.maxSimultaneousTeams;

        if (missingConfiguration.length > 0) {
          return {
            status: "MISSING_CONFIGURATION",
            providerId: input.providerId,
            missingConfiguration,
            coverageMatch: coverageMatch.matched,
            providerScheduleAvailable,
            paused,
            suspended,
            simultaneousTeamLimit,
            teams,
          };
        }

        return {
          status: "AVAILABLE_FACTS",
          providerId: input.providerId,
          coverageMatch: coverageMatch.matched,
          providerScheduleAvailable,
          paused,
          suspended,
          simultaneousTeamLimit: simultaneousTeamLimit as number,
          teams,
        };
      },
    );
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
          countryActive: true,
          cityActive: true,
          districtActive: true,
        },
      );
      return {
        matched,
        matchedBy: matched
          ? coverageDistrictIds.includes(area.districtId)
            ? "DISTRICT"
            : "CITY"
          : null,
      };
    }

    const matched = coverageCityIds.includes(area.cityId);
    return { matched, matchedBy: matched ? "CITY" : null };
  }

  private async resolveTextualArea(
    localityReader: ProviderAvailabilityLocalityReader,
    input: {
      readonly location: {
        readonly countryId: string;
        readonly cityId: string;
        readonly districtId?: string;
      };
    },
  ): Promise<ResolvedTextualArea> {
    const districtId = input.location.districtId;
    if (districtId !== undefined) {
      const district = await localityReader.findDistrictById(districtId);
      if (
        district === null ||
        district.cityId !== input.location.cityId ||
        district.countryId !== input.location.countryId ||
        !district.isActive ||
        !district.cityActive ||
        !district.countryActive
      ) {
        return {
          active: false,
          countryId: input.location.countryId,
          cityId: input.location.cityId,
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
    const districtIds = await localityReader.listActiveDistrictIdsForCity(
      city.id,
    );
    return {
      active: true,
      countryId: city.countryId,
      cityId: city.id,
      districtId: null,
      districtIdsForMatching: districtIds,
    };
  }
}

/**
 * @desc Bind Eligibility availability reads to an opaque shared transaction.
 * @access Composition
 * @explanation Reuses the Eligibility UoW transaction — does not open a nested
 * Providers availability transaction (DEC-079 / DEC-081).
 */
export function createBoundEligibilityAvailabilityReader(
  transactionContext: unknown,
): EligibilityAvailabilityReader {
  const bound: TransactionContext = {
    repository: createPrismaProviderAvailabilityRepository(transactionContext),
    localityReader: createTransactionalLocalityReader(transactionContext),
    countryTimeZoneReader:
      createTransactionalCountryTimeZoneReader(transactionContext),
  };
  return new EligibilityAvailabilityReaderService({
    runInReadTransaction: async (work) => work(bound),
  });
}
