/**
 * Shared calendar utility foundation for Providers availability (R1-P10).
 * Node 24 lacks a global `Temporal`, so `@js-temporal/polyfill` is the single
 * source of civil-date/time-zone arithmetic. Schedule validation itself stays
 * wall-clock local-minute based per DEC-054.
 */

import { Temporal } from "@js-temporal/polyfill";

export type AvailabilityWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeeklySchedulePeriodInput {
  readonly weekday: AvailabilityWeekday;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly endsNextDay: boolean;
}

export interface DatedScheduleExceptionInput {
  readonly localDate: string;
  readonly closed: boolean;
  readonly startMinute?: number | null;
  readonly endMinute?: number | null;
  readonly endsNextDay?: boolean | null;
}

export interface LocalCivilInterval {
  readonly localDate: string;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly source: "WEEKLY" | "EXCEPTION";
}

export interface UtcIntervalLocalSegment {
  readonly localDate: string;
  readonly startMinute: number;
  readonly endMinute: number;
}

interface SplitPeriodSegment {
  readonly weekday: AvailabilityWeekday;
  readonly startMinute: number;
  readonly endMinute: number;
}

interface DatedSegment {
  readonly localDate: string;
  readonly startMinute: number;
  readonly endMinute: number;
}

const MINUTES_PER_DAY = 1_440;
const MIN_MINUTE = 0;
const MAX_STORED_MINUTE = MINUTES_PER_DAY - 1;
const ISO_LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a syntactically valid, recognized IANA time zone identifier. */
export function isValidIanaTimeZone(candidate: string): boolean {
  try {
    Temporal.Now.instant().toZonedDateTimeISO(candidate);
    return true;
  } catch {
    return false;
  }
}

/** The current civil (local) date in the given IANA time zone, as `YYYY-MM-DD`. */
export function civilDateInTimeZone(
  timeZone: string,
  instant: Temporal.Instant = Temporal.Now.instant(),
): string {
  return instant.toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

/** Minutes since local midnight for an instant in the given IANA time zone. */
export function minutesSinceLocalMidnight(
  timeZone: string,
  instant: Temporal.Instant = Temporal.Now.instant(),
): number {
  const zoned = instant.toZonedDateTimeISO(timeZone);
  return zoned.hour * 60 + zoned.minute;
}

export function validateSchedulePeriods(
  periods: readonly WeeklySchedulePeriodInput[],
): string | null {
  const segments: DatedSegment[] = [];

  for (const [index, period] of periods.entries()) {
    const primitiveError = validateWeeklyPeriodPrimitive(period, index);
    if (primitiveError !== null) return primitiveError;

    const durationError = validatePeriodDuration(
      period.startMinute,
      period.endMinute,
      period.endsNextDay,
      `period ${index}`,
    );
    if (durationError !== null) return durationError;

    for (const segment of splitWeeklyPeriod(period)) {
      segments.push({
        localDate: String(segment.weekday),
        startMinute: segment.startMinute,
        endMinute: segment.endMinute,
      });
    }
  }

  return validateNoOverlaps(segments, "weekly schedule periods");
}

export function validateDatedExceptions(
  exceptions: readonly DatedScheduleExceptionInput[],
): string | null {
  const exceptionDates = new Set<string>();

  for (const [index, exception] of exceptions.entries()) {
    if (!isValidLocalDate(exception.localDate)) {
      return `exception ${index} has invalid localDate`;
    }
    exceptionDates.add(exception.localDate);
  }

  const datesWithClosedExceptions = new Set<string>();
  const datesWithOpenExceptions = new Set<string>();
  const openSegments: DatedSegment[] = [];

  for (const [index, exception] of exceptions.entries()) {
    if (exception.closed) {
      if (hasOpenBounds(exception)) {
        return `exception ${index} is closed and must not include open-period minutes`;
      }
      if (datesWithOpenExceptions.has(exception.localDate)) {
        return `exception ${index} conflicts with an open exception on the same date`;
      }
      if (datesWithClosedExceptions.has(exception.localDate)) {
        return `exception ${index} duplicates a closed exception date`;
      }
      datesWithClosedExceptions.add(exception.localDate);
      continue;
    }

    if (datesWithClosedExceptions.has(exception.localDate)) {
      return `exception ${index} conflicts with a closed exception on the same date`;
    }

    const startMinute = exception.startMinute;
    const endMinute = exception.endMinute;
    const endsNextDay = exception.endsNextDay ?? false;

    if (!isStoredMinute(startMinute)) {
      return `exception ${index} has invalid startMinute`;
    }
    if (!isStoredMinute(endMinute)) {
      return `exception ${index} has invalid endMinute`;
    }

    const durationError = validatePeriodDuration(
      startMinute,
      endMinute,
      endsNextDay,
      `exception ${index}`,
    );
    if (durationError !== null) return durationError;

    datesWithOpenExceptions.add(exception.localDate);
    openSegments.push(...splitDatedPeriod(exception.localDate, startMinute, endMinute, endsNextDay, exceptionDates));
  }

  return validateNoOverlaps(openSegments, "dated schedule exceptions");
}

export function splitWeeklyPeriod(
  period: WeeklySchedulePeriodInput,
): readonly SplitPeriodSegment[] {
  if (!period.endsNextDay) {
    return [{ weekday: period.weekday, startMinute: period.startMinute, endMinute: period.endMinute }];
  }

  const segments: SplitPeriodSegment[] = [];
  if (period.startMinute < MINUTES_PER_DAY) {
    segments.push({
      weekday: period.weekday,
      startMinute: period.startMinute,
      endMinute: MINUTES_PER_DAY,
    });
  }
  if (period.endMinute > MIN_MINUTE) {
    segments.push({
      weekday: nextWeekday(period.weekday),
      startMinute: MIN_MINUTE,
      endMinute: period.endMinute,
    });
  }

  return segments.filter((segment) => segment.startMinute < segment.endMinute);
}

export function availabilityIntervalsForCivilDate(input: {
  readonly localDate: string;
  readonly weeklyPeriods: readonly WeeklySchedulePeriodInput[];
  readonly exceptions: readonly DatedScheduleExceptionInput[];
}): readonly LocalCivilInterval[] {
  const exceptionByDate = new Map<string, readonly DatedScheduleExceptionInput[]>();
  for (const exception of input.exceptions) {
    const existing = exceptionByDate.get(exception.localDate) ?? [];
    exceptionByDate.set(exception.localDate, [...existing, exception]);
  }

  const currentDateExceptions = exceptionByDate.get(input.localDate);
  if (currentDateExceptions !== undefined) {
    if (currentDateExceptions.some((exception) => exception.closed)) {
      return [];
    }

    return intervalsFromOpenExceptionsOnDate(input.localDate, currentDateExceptions);
  }

  const previousDate = addDays(input.localDate, -1);
  const previousDateExceptions = exceptionByDate.get(previousDate);
  const intervals: LocalCivilInterval[] = [];

  if (previousDateExceptions === undefined) {
    intervals.push(...weeklyIntervalsForDate(input.localDate, input.weeklyPeriods, true));
  } else if (!previousDateExceptions.some((exception) => exception.closed)) {
    intervals.push(...exceptionCarryIntervals(input.localDate, previousDate, previousDateExceptions));
  }

  intervals.push(...weeklyIntervalsForDate(input.localDate, input.weeklyPeriods, false));

  return sortLocalCivilIntervals(intervals);
}

export function intersectHalfOpenIntervals(
  left: readonly LocalCivilInterval[],
  right: readonly LocalCivilInterval[],
): readonly LocalCivilInterval[] {
  const intersections: LocalCivilInterval[] = [];

  for (const leftInterval of left) {
    for (const rightInterval of right) {
      if (leftInterval.localDate !== rightInterval.localDate) continue;

      const startMinute = Math.max(leftInterval.startMinute, rightInterval.startMinute);
      const endMinute = Math.min(leftInterval.endMinute, rightInterval.endMinute);
      if (startMinute >= endMinute) continue;

      intersections.push({
        localDate: leftInterval.localDate,
        startMinute,
        endMinute,
        source:
          leftInterval.source === "EXCEPTION" || rightInterval.source === "EXCEPTION"
            ? "EXCEPTION"
            : "WEEKLY",
      });
    }
  }

  return sortLocalCivilIntervals(intersections);
}

/**
 * Project a half-open UTC interval into monotonic local-minute segments.
 *
 * The interval is split at both civil midnights and IANA offset transitions.
 * Splitting at offset transitions is essential during a fall-back fold: the
 * same wall-clock minute occurs twice, and treating the whole UTC interval as
 * one local-minute range can collapse a positive interval to zero (or reverse
 * its endpoints). Endpoints are rounded outwards to the schedule's minute
 * precision, so the result never falsely claims coverage of sub-minute time.
 */
export function utcIntervalToLocalSegments(input: {
  readonly timeZone: string;
  readonly intervalStart: Date;
  readonly intervalEnd: Date;
}): readonly UtcIntervalLocalSegment[] {
  const intervalStart = Temporal.Instant.from(input.intervalStart.toISOString());
  const intervalEnd = Temporal.Instant.from(input.intervalEnd.toISOString());
  if (Temporal.Instant.compare(intervalStart, intervalEnd) >= 0) {
    return [];
  }

  const segments: UtcIntervalLocalSegment[] = [];
  let cursor = intervalStart;

  while (Temporal.Instant.compare(cursor, intervalEnd) < 0) {
    const zonedCursor = cursor.toZonedDateTimeISO(input.timeZone);
    const localDate = zonedCursor.toPlainDate();
    const nextMidnight = localDate
      .add({ days: 1 })
      .toZonedDateTime({
        timeZone: input.timeZone,
        plainTime: Temporal.PlainTime.from("00:00"),
      })
      .toInstant();
    const nextTransition = zonedCursor.getTimeZoneTransition("next")?.toInstant();

    let segmentEnd = minTemporalInstant(intervalEnd, nextMidnight);
    if (
      nextTransition !== undefined &&
      Temporal.Instant.compare(nextTransition, cursor) > 0
    ) {
      segmentEnd = minTemporalInstant(segmentEnd, nextTransition);
    }

    const lastIncluded = segmentEnd.subtract({ nanoseconds: 1 });
    const lastIncludedZoned = lastIncluded.toZonedDateTimeISO(input.timeZone);
    const startMinute = zonedCursor.hour * 60 + zonedCursor.minute;
    const endMinute =
      lastIncludedZoned.hour * 60 + lastIncludedZoned.minute + 1;

    segments.push({
      localDate: localDate.toString(),
      startMinute,
      endMinute,
    });
    cursor = segmentEnd;
  }

  return segments;
}

/**
 * Require every instant in a UTC interval to be covered by local civil
 * availability. The caller supplies the already-resolved Provider or
 * Provider/Worker intervals for each civil date.
 */
export function isUtcIntervalFullyCoveredByCivilAvailability(input: {
  readonly timeZone: string;
  readonly intervalStart: Date;
  readonly intervalEnd: Date;
  readonly intervalsForCivilDate: (
    localDate: string,
  ) => readonly Pick<LocalCivilInterval, "startMinute" | "endMinute">[];
}): boolean {
  const requestedSegments = utcIntervalToLocalSegments(input);
  if (requestedSegments.length === 0) {
    return false;
  }

  return requestedSegments.every((segment) =>
    localIntervalsCoverSegment({
      ...segment,
      intervals: input.intervalsForCivilDate(segment.localDate),
    }),
  );
}

export { Temporal };

function validateWeeklyPeriodPrimitive(
  period: WeeklySchedulePeriodInput,
  index: number,
): string | null {
  if (!isAvailabilityWeekday(period.weekday)) {
    return `period ${index} has invalid weekday`;
  }
  if (!isStoredMinute(period.startMinute)) {
    return `period ${index} has invalid startMinute`;
  }
  if (!isStoredMinute(period.endMinute)) {
    return `period ${index} has invalid endMinute`;
  }
  if (typeof period.endsNextDay !== "boolean") {
    return `period ${index} has invalid endsNextDay`;
  }
  return null;
}

function validatePeriodDuration(
  startMinute: number,
  endMinute: number,
  endsNextDay: boolean,
  label: string,
): string | null {
  if (!endsNextDay) {
    return endMinute > startMinute
      ? null
      : `${label} must end after it starts unless endsNextDay is true`;
  }

  const duration = MINUTES_PER_DAY - startMinute + endMinute;
  if (duration < 1 || duration > MINUTES_PER_DAY) {
    return `${label} overnight duration must be between 1 and 1440 minutes`;
  }
  return null;
}

function validateNoOverlaps(
  segments: readonly DatedSegment[],
  label: string,
): string | null {
  const byDate = new Map<string, DatedSegment[]>();

  for (const segment of segments) {
    if (segment.startMinute >= segment.endMinute) continue;
    const existing = byDate.get(segment.localDate) ?? [];
    existing.push(segment);
    byDate.set(segment.localDate, existing);
  }

  for (const [date, dateSegments] of byDate.entries()) {
    const sorted = [...dateSegments].sort(compareDatedSegments);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous === undefined || current === undefined) continue;
      if (current.startMinute < previous.endMinute) {
        return `${label} overlap on ${date}`;
      }
    }
  }

  return null;
}

function splitDatedPeriod(
  localDate: string,
  startMinute: number,
  endMinute: number,
  endsNextDay: boolean,
  exceptionDates: ReadonlySet<string>,
): readonly DatedSegment[] {
  if (!endsNextDay) {
    return [{ localDate, startMinute, endMinute }];
  }

  const nextDate = addDays(localDate, 1);
  const segments: DatedSegment[] = [];

  if (startMinute < MINUTES_PER_DAY) {
    segments.push({ localDate, startMinute, endMinute: MINUTES_PER_DAY });
  }
  if (endMinute > MIN_MINUTE && !exceptionDates.has(nextDate)) {
    segments.push({ localDate: nextDate, startMinute: MIN_MINUTE, endMinute });
  }

  return segments.filter((segment) => segment.startMinute < segment.endMinute);
}

function weeklyIntervalsForDate(
  localDate: string,
  weeklyPeriods: readonly WeeklySchedulePeriodInput[],
  carryInOnly: boolean,
): readonly LocalCivilInterval[] {
  const weekday = weekdayForDate(localDate);
  const previousWeekday = previousAvailabilityWeekday(weekday);
  const intervals: LocalCivilInterval[] = [];

  for (const period of weeklyPeriods) {
    for (const segment of splitWeeklyPeriod(period)) {
      const isCarryInSegment =
        period.endsNextDay && period.weekday === previousWeekday && segment.weekday === weekday;
      const isSameDateSegment = period.weekday === weekday && segment.weekday === weekday;

      if ((carryInOnly && !isCarryInSegment) || (!carryInOnly && !isSameDateSegment)) {
        continue;
      }

      intervals.push({
        localDate,
        startMinute: segment.startMinute,
        endMinute: segment.endMinute,
        source: "WEEKLY",
      });
    }
  }

  return intervals;
}

function intervalsFromOpenExceptionsOnDate(
  localDate: string,
  exceptions: readonly DatedScheduleExceptionInput[],
): readonly LocalCivilInterval[] {
  const intervals: LocalCivilInterval[] = [];

  for (const exception of exceptions) {
    if (exception.closed) continue;
    if (!isStoredMinute(exception.startMinute) || !isStoredMinute(exception.endMinute)) continue;

    const endMinute =
      exception.endsNextDay === true ? MINUTES_PER_DAY : exception.endMinute;
    if (exception.startMinute < endMinute) {
      intervals.push({
        localDate,
        startMinute: exception.startMinute,
        endMinute,
        source: "EXCEPTION",
      });
    }
  }

  return sortLocalCivilIntervals(intervals);
}

function exceptionCarryIntervals(
  localDate: string,
  previousDate: string,
  exceptions: readonly DatedScheduleExceptionInput[],
): readonly LocalCivilInterval[] {
  const intervals: LocalCivilInterval[] = [];

  for (const exception of exceptions) {
    if (
      exception.closed ||
      exception.endsNextDay !== true ||
      !isStoredMinute(exception.endMinute) ||
      exception.endMinute === MIN_MINUTE ||
      exception.localDate !== previousDate
    ) {
      continue;
    }

    intervals.push({
      localDate,
      startMinute: MIN_MINUTE,
      endMinute: exception.endMinute,
      source: "EXCEPTION",
    });
  }

  return intervals;
}

function isAvailabilityWeekday(candidate: number): candidate is AvailabilityWeekday {
  return (
    Number.isInteger(candidate) &&
    candidate >= 1 &&
    candidate <= 7
  );
}

function isStoredMinute(candidate: unknown): candidate is number {
  return (
    typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= MIN_MINUTE &&
    candidate <= MAX_STORED_MINUTE
  );
}

function isValidLocalDate(candidate: string): boolean {
  if (!ISO_LOCAL_DATE_PATTERN.test(candidate)) return false;
  try {
    return Temporal.PlainDate.from(candidate).toString() === candidate;
  } catch {
    return false;
  }
}

function hasOpenBounds(exception: DatedScheduleExceptionInput): boolean {
  return (
    (exception.startMinute !== undefined && exception.startMinute !== null) ||
    (exception.endMinute !== undefined && exception.endMinute !== null) ||
    (exception.endsNextDay !== undefined && exception.endsNextDay !== null)
  );
}

function weekdayForDate(localDate: string): AvailabilityWeekday {
  return Temporal.PlainDate.from(localDate).dayOfWeek as AvailabilityWeekday;
}

function addDays(localDate: string, days: number): string {
  return Temporal.PlainDate.from(localDate).add({ days }).toString();
}

function nextWeekday(weekday: AvailabilityWeekday): AvailabilityWeekday {
  return weekday === 7 ? 1 : ((weekday + 1) as AvailabilityWeekday);
}

function previousAvailabilityWeekday(weekday: AvailabilityWeekday): AvailabilityWeekday {
  return weekday === 1 ? 7 : ((weekday - 1) as AvailabilityWeekday);
}

function compareDatedSegments(left: DatedSegment, right: DatedSegment): number {
  return (
    left.localDate.localeCompare(right.localDate) ||
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute
  );
}

function sortLocalCivilIntervals(
  intervals: readonly LocalCivilInterval[],
): readonly LocalCivilInterval[] {
  return [...intervals].sort(
    (left, right) =>
      left.localDate.localeCompare(right.localDate) ||
      left.startMinute - right.startMinute ||
      left.endMinute - right.endMinute ||
      left.source.localeCompare(right.source),
  );
}

function minTemporalInstant(
  left: Temporal.Instant,
  right: Temporal.Instant,
): Temporal.Instant {
  return Temporal.Instant.compare(left, right) <= 0 ? left : right;
}

function localIntervalsCoverSegment(input: {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly intervals: readonly {
    readonly startMinute: number;
    readonly endMinute: number;
  }[];
}): boolean {
  let cursor = input.startMinute;
  for (const interval of [...input.intervals].sort(
    (left, right) =>
      left.startMinute - right.startMinute ||
      left.endMinute - right.endMinute,
  )) {
    if (interval.endMinute <= cursor) continue;
    if (interval.startMinute > cursor) return false;
    cursor = Math.max(cursor, interval.endMinute);
    if (cursor >= input.endMinute) return true;
  }
  return cursor >= input.endMinute;
}
