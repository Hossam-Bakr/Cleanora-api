/**
 * Pure Providers-owned temporary pause policy (DEC-057).
 * No I/O; expiry is evaluated from time without mutating pause rows.
 */

export interface ProviderTemporaryPauseIntervalFacts {
  readonly startedAt: Date;
  readonly endsAt: Date | null;
  readonly resumedAt: Date | null;
}

export type ProviderOperationalStatusFact = "INACTIVE" | "LIVE" | "SUSPENDED";

export type PauseEndsAtValidationError = "ENDS_AT_NOT_AFTER_START";

/**
 * @desc Validate that an optional pause end instant is strictly after start.
 * @explanation Half-open `[startedAt, endsAt)` requires a positive duration
 * when `endsAt` is present; open-ended pauses omit `endsAt`.
 */
export function validatePauseEndsAt(
  startedAt: Date,
  endsAt: Date | null | undefined,
): PauseEndsAtValidationError | null {
  if (endsAt === null || endsAt === undefined) {
    return null;
  }
  if (!(endsAt.getTime() > startedAt.getTime())) {
    return "ENDS_AT_NOT_AFTER_START";
  }
  return null;
}

/**
 * @desc Decide whether a pause row is effective at one UTC instant.
 * @explanation Effective means unresolved (`resumedAt == null`) and the
 * instant lies in the half-open window `[startedAt, endsAt)` when `endsAt`
 * is set, or `[startedAt, +∞)` when open-ended (DEC-057). Expiry is pure
 * time evaluation and never mutates the row.
 */
export function isEffectivePauseAt(
  pause: ProviderTemporaryPauseIntervalFacts,
  instant: Date,
): boolean {
  if (pause.resumedAt !== null) {
    return false;
  }
  const at = instant.getTime();
  if (at < pause.startedAt.getTime()) {
    return false;
  }
  if (pause.endsAt !== null && !(at < pause.endsAt.getTime())) {
    return false;
  }
  return true;
}

/**
 * @desc Decide whether a half-open UTC evaluation interval overlaps an
 * unresolved pause window.
 * @explanation Intervals are half-open `[start, end)`. A resumed pause never
 * overlaps. An open-ended pause uses `endsAt = +∞`. Empty evaluation
 * intervals (`start >= end`) never overlap.
 */
export function doesRequestedIntervalOverlapEffectivePause(
  pause: ProviderTemporaryPauseIntervalFacts,
  intervalStart: Date,
  intervalEnd: Date,
): boolean {
  if (pause.resumedAt !== null) {
    return false;
  }
  if (!(intervalStart.getTime() < intervalEnd.getTime())) {
    return false;
  }
  const pauseStart = pause.startedAt.getTime();
  const pauseEnd =
    pause.endsAt === null ? Number.POSITIVE_INFINITY : pause.endsAt.getTime();
  return (
    pauseStart < intervalEnd.getTime() && intervalStart.getTime() < pauseEnd
  );
}

export interface ProviderRuntimeAvailabilityInput {
  readonly operationalStatus: ProviderOperationalStatusFact;
  readonly pause: ProviderTemporaryPauseIntervalFacts | null;
  readonly at: Date;
  readonly interval?: {
    readonly start: Date;
    readonly end: Date;
  };
}

/**
 * @desc Decide whether runtime evaluation must report unavailable/zero
 * capacity (DEC-057).
 * @explanation Suspension or an overlapping effective pause blocks runtime
 * evaluation. Neither condition erases schedule/coverage configuration or
 * alters approval, suspension, or go-live state.
 */
export function isProviderRuntimeUnavailable(
  input: ProviderRuntimeAvailabilityInput,
): boolean {
  if (input.operationalStatus === "SUSPENDED") {
    return true;
  }
  if (input.pause === null) {
    return false;
  }
  if (input.interval !== undefined) {
    return doesRequestedIntervalOverlapEffectivePause(
      input.pause,
      input.interval.start,
      input.interval.end,
    );
  }
  return isEffectivePauseAt(input.pause, input.at);
}
