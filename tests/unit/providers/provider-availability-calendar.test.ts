import {
  availabilityIntervalsForCivilDate,
  civilDateInTimeZone,
  intersectHalfOpenIntervals,
  isUtcIntervalFullyCoveredByCivilAvailability,
  isValidIanaTimeZone,
  minutesSinceLocalMidnight,
  splitWeeklyPeriod,
  Temporal,
  utcIntervalToLocalSegments,
  validateDatedExceptions,
  validateSchedulePeriods,
} from "../../../src/modules/providers/domain/provider-availability-calendar.js";

describe("Provider availability shared calendar utility (R1-P10 Batch A foundation)", () => {
  it("accepts a valid IANA time zone identifier", () => {
    expect(isValidIanaTimeZone("Africa/Cairo")).toBe(true);
  });

  it("rejects an unrecognized time zone identifier", () => {
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
  });

  it("computes the civil date for a fixed instant in Africa/Cairo", () => {
    const instant = Temporal.Instant.from("2026-01-01T22:30:00Z");
    expect(civilDateInTimeZone("Africa/Cairo", instant)).toBe("2026-01-02");
  });

  it("computes minutes since local midnight for a fixed instant", () => {
    const instant = Temporal.Instant.from("2026-01-01T22:30:00Z");
    // Africa/Cairo is UTC+2 (no DST): 22:30 UTC -> 00:30 local -> 30 minutes.
    expect(minutesSinceLocalMidnight("Africa/Cairo", instant)).toBe(30);
  });

  it("maps Europe/Berlin spring-forward instants to the post-gap wall clock", () => {
    const instant = Temporal.Instant.from("2026-03-29T01:30:00Z");

    expect(civilDateInTimeZone("Europe/Berlin", instant)).toBe("2026-03-29");
    expect(minutesSinceLocalMidnight("Europe/Berlin", instant)).toBe(210);
  });

  it("maps Europe/Berlin fall-back repeated wall-clock minutes deterministically", () => {
    const firstRepeatedInstant = Temporal.Instant.from("2026-10-25T00:30:00Z");
    const secondRepeatedInstant = Temporal.Instant.from("2026-10-25T01:30:00Z");

    expect(civilDateInTimeZone("Europe/Berlin", firstRepeatedInstant)).toBe("2026-10-25");
    expect(civilDateInTimeZone("Europe/Berlin", secondRepeatedInstant)).toBe("2026-10-25");
    expect(minutesSinceLocalMidnight("Europe/Berlin", firstRepeatedInstant)).toBe(150);
    expect(minutesSinceLocalMidnight("Europe/Berlin", secondRepeatedInstant)).toBe(150);
  });

  it("splits a spring-forward interval at the IANA offset transition", () => {
    expect(
      utcIntervalToLocalSegments({
        timeZone: "Europe/Berlin",
        intervalStart: new Date("2026-03-29T00:30:00.000Z"),
        intervalEnd: new Date("2026-03-29T01:30:00.000Z"),
      }),
    ).toEqual([
      { localDate: "2026-03-29", startMinute: 90, endMinute: 120 },
      { localDate: "2026-03-29", startMinute: 180, endMinute: 210 },
    ]);
  });

  it("splits a fall-back interval instead of collapsing repeated minutes", () => {
    const input = {
      timeZone: "Europe/Berlin",
      intervalStart: new Date("2026-10-25T00:30:00.000Z"),
      intervalEnd: new Date("2026-10-25T01:30:00.000Z"),
    };

    expect(utcIntervalToLocalSegments(input)).toEqual([
      { localDate: "2026-10-25", startMinute: 150, endMinute: 180 },
      { localDate: "2026-10-25", startMinute: 120, endMinute: 150 },
    ]);
    expect(
      isUtcIntervalFullyCoveredByCivilAvailability({
        ...input,
        intervalsForCivilDate: () => [],
      }),
    ).toBe(false);
    expect(
      isUtcIntervalFullyCoveredByCivilAvailability({
        ...input,
        intervalsForCivilDate: () => [{ startMinute: 120, endMinute: 180 }],
      }),
    ).toBe(true);
  });
});

describe("Provider availability DEC-054 weekly schedule policy", () => {
  it("accepts adjacent same-day half-open periods", () => {
    expect(
      validateSchedulePeriods([
        { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
        { weekday: 1, startMinute: 720, endMinute: 1_020, endsNextDay: false },
      ]),
    ).toBeNull();
  });

  it("rejects overlapping same-day half-open periods", () => {
    expect(
      validateSchedulePeriods([
        { weekday: 1, startMinute: 480, endMinute: 720, endsNextDay: false },
        { weekday: 1, startMinute: 719, endMinute: 1_020, endsNextDay: false },
      ]),
    ).toContain("overlap");
  });

  it("rejects overnight carryover overlap with the next weekday", () => {
    expect(
      validateSchedulePeriods([
        { weekday: 1, startMinute: 1_320, endMinute: 120, endsNextDay: true },
        { weekday: 2, startMinute: 60, endMinute: 180, endsNextDay: false },
      ]),
    ).toContain("overlap");
  });

  it("accepts overnight carryover adjacent to the next weekday", () => {
    expect(
      validateSchedulePeriods([
        { weekday: 1, startMinute: 1_320, endMinute: 120, endsNextDay: true },
        { weekday: 2, startMinute: 120, endMinute: 180, endsNextDay: false },
      ]),
    ).toBeNull();
  });

  it("splits overnight periods at midnight", () => {
    expect(
      splitWeeklyPeriod({
        weekday: 1,
        startMinute: 1_320,
        endMinute: 120,
        endsNextDay: true,
      }),
    ).toEqual([
      { weekday: 1, startMinute: 1_320, endMinute: 1_440 },
      { weekday: 2, startMinute: 0, endMinute: 120 },
    ]);
  });

  it("accepts a 24-hour period only when endsNextDay is true", () => {
    expect(
      validateSchedulePeriods([
        { weekday: 3, startMinute: 0, endMinute: 0, endsNextDay: true },
      ]),
    ).toBeNull();
    expect(
      splitWeeklyPeriod({
        weekday: 3,
        startMinute: 0,
        endMinute: 0,
        endsNextDay: true,
      }),
    ).toEqual([{ weekday: 3, startMinute: 0, endMinute: 1_440 }]);
  });

  it("rejects zero-length periods without endsNextDay", () => {
    expect(
      validateSchedulePeriods([
        { weekday: 3, startMinute: 600, endMinute: 600, endsNextDay: false },
      ]),
    ).toContain("endsNextDay");
  });
});

describe("Provider availability DEC-054 dated exceptions", () => {
  it("accepts adjacent open exception periods and nullable closed bounds", () => {
    expect(
      validateDatedExceptions([
        {
          localDate: "2026-01-06",
          closed: false,
          startMinute: 480,
          endMinute: 720,
          endsNextDay: false,
        },
        {
          localDate: "2026-01-06",
          closed: false,
          startMinute: 720,
          endMinute: 1_020,
          endsNextDay: null,
        },
        {
          localDate: "2026-01-07",
          closed: true,
          startMinute: null,
          endMinute: null,
          endsNextDay: null,
        },
      ]),
    ).toBeNull();
  });

  it("rejects overlapping open exception periods", () => {
    expect(
      validateDatedExceptions([
        {
          localDate: "2026-01-06",
          closed: false,
          startMinute: 480,
          endMinute: 720,
          endsNextDay: false,
        },
        {
          localDate: "2026-01-06",
          closed: false,
          startMinute: 719,
          endMinute: 1_020,
          endsNextDay: false,
        },
      ]),
    ).toContain("overlap");
  });

  it("uses a holiday to truncate weekly hours and prior-day carryover", () => {
    expect(
      availabilityIntervalsForCivilDate({
        localDate: "2026-01-06",
        weeklyPeriods: [
          { weekday: 1, startMinute: 1_320, endMinute: 120, endsNextDay: true },
          { weekday: 2, startMinute: 540, endMinute: 1_020, endsNextDay: false },
        ],
        exceptions: [{ localDate: "2026-01-06", closed: true }],
      }),
    ).toEqual([]);
  });

  it("uses an open exception to replace weekly hours and prior-day carryover", () => {
    expect(
      availabilityIntervalsForCivilDate({
        localDate: "2026-01-06",
        weeklyPeriods: [
          { weekday: 1, startMinute: 1_320, endMinute: 120, endsNextDay: true },
          { weekday: 2, startMinute: 540, endMinute: 1_020, endsNextDay: false },
        ],
        exceptions: [
          {
            localDate: "2026-01-06",
            closed: false,
            startMinute: 720,
            endMinute: 840,
            endsNextDay: false,
          },
        ],
      }),
    ).toEqual([
      {
        localDate: "2026-01-06",
        startMinute: 720,
        endMinute: 840,
        source: "EXCEPTION",
      },
    ]);
  });

  it("carries an overnight open exception only when the next date has no exception", () => {
    const mondayException = {
      localDate: "2026-01-05",
      closed: false,
      startMinute: 1_320,
      endMinute: 120,
      endsNextDay: true,
    };

    expect(
      availabilityIntervalsForCivilDate({
        localDate: "2026-01-06",
        weeklyPeriods: [],
        exceptions: [mondayException],
      }),
    ).toEqual([
      {
        localDate: "2026-01-06",
        startMinute: 0,
        endMinute: 120,
        source: "EXCEPTION",
      },
    ]);

    expect(
      availabilityIntervalsForCivilDate({
        localDate: "2026-01-06",
        weeklyPeriods: [],
        exceptions: [mondayException, { localDate: "2026-01-06", closed: true }],
      }),
    ).toEqual([]);
  });
});

describe("Provider availability half-open interval intersection", () => {
  it("is commutative by localDate", () => {
    const left = [
      { localDate: "2026-01-06", startMinute: 480, endMinute: 720, source: "WEEKLY" as const },
      { localDate: "2026-01-07", startMinute: 600, endMinute: 660, source: "WEEKLY" as const },
    ];
    const right = [
      {
        localDate: "2026-01-06",
        startMinute: 540,
        endMinute: 780,
        source: "EXCEPTION" as const,
      },
    ];
    const expected = [
      {
        localDate: "2026-01-06",
        startMinute: 540,
        endMinute: 720,
        source: "EXCEPTION",
      },
    ];

    expect(intersectHalfOpenIntervals(left, right)).toEqual(expected);
    expect(intersectHalfOpenIntervals(right, left)).toEqual(expected);
  });

  it("does not emit adjacent intersections", () => {
    expect(
      intersectHalfOpenIntervals(
        [{ localDate: "2026-01-06", startMinute: 480, endMinute: 720, source: "WEEKLY" }],
        [{ localDate: "2026-01-06", startMinute: 720, endMinute: 900, source: "WEEKLY" }],
      ),
    ).toEqual([]);
  });
});
