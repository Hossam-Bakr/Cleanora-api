/**
 * Providers-owned helper: whether one worker fully covers a booking UTC window.
 * Reuses capacity calendar intersection; no bookings Prisma access.
 */

import type { ProviderAvailabilityTransactionContext } from "./infrastructure/prisma-provider-availability.repository.js";
import { isProviderWorkerAvailableForFullUtcInterval } from "./provider-capacity.service.js";

/**
 * @desc Check worker+provider calendar coverage for a booking window.
 * @access Providers module helper
 */
export async function coversWorkerBookingWindow(
  runInReadTransaction: <T>(
    work: (context: ProviderAvailabilityTransactionContext) => Promise<T>,
  ) => Promise<T>,
  input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
  },
): Promise<boolean> {
  if (!(input.startsAt.getTime() < input.endsAt.getTime())) {
    return false;
  }
  return runInReadTransaction(async ({ repository, countryTimeZoneReader }) => {
    const configuration = await repository.findConfigurationByProviderId(
      input.providerId,
    );
    if (configuration === null || configuration.weeklyPeriods.length === 0) {
      return false;
    }
    const authority = await repository.resolveAuthorityFacts(
      input.providerId,
      "__assignment_coverage__",
    );
    if (authority.providerCountryId === null) {
      return false;
    }
    const timeZone = await countryTimeZoneReader.getTimeZoneForCountry(
      authority.providerCountryId,
    );
    if (timeZone === null) {
      return false;
    }
    const workerCalendar = await repository.findWorkerCalendarByProviderId({
      providerId: input.providerId,
      workerId: input.workerId,
    });
    if (workerCalendar === null) {
      return false;
    }
    return isProviderWorkerAvailableForFullUtcInterval({
      timeZone,
      intervalStart: input.startsAt,
      intervalEnd: input.endsAt,
      providerWeeklyPeriods: configuration.weeklyPeriods,
      providerExceptions: configuration.exceptions,
      workerWeeklyPeriods: workerCalendar.weeklyPeriods,
      workerExceptions: workerCalendar.exceptions,
    });
  });
}
