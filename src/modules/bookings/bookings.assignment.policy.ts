/**
 * Pure booking assignment policy (R1-P17).
 * No I/O — composition, escort/cleans, crew preference, EX-01 team lock, units.
 */

export type AssignmentWorkerType = "CLEANING_STAFF" | "ESCORT" | "OTHER";
export type AssignmentGender = "male" | "female" | "other_or_unspecified";
export type AssignmentCrewPreference = "ALL_MALE" | "ALL_FEMALE" | "ANY";

export type AssignmentPolicyFailureCode =
  | "BOOKING_ASSIGNMENT_COMPOSITION_INVALID"
  | "BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN"
  | "BOOKING_ASSIGNMENT_CREW_MISMATCH"
  | "BOOKING_ASSIGNMENT_TEAM_MISMATCH"
  | "BOOKING_ASSIGNMENT_DUPLICATE_WORKER"
  | "BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS";

export interface AssignmentMemberInput {
  readonly workerId: string;
  readonly workerType: AssignmentWorkerType;
  readonly gender: AssignmentGender;
  readonly cleans: boolean;
}

export type AssignmentPolicyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: AssignmentPolicyFailureCode };

/**
 * @desc Reject duplicate worker ids in one assignment payload.
 * @access Bookings domain
 */
export function rejectDuplicateWorkerIds(
  workerIds: readonly string[],
): AssignmentPolicyResult {
  const seen = new Set<string>();
  for (const id of workerIds) {
    if (seen.has(id)) {
      return { ok: false, code: "BOOKING_ASSIGNMENT_DUPLICATE_WORKER" };
    }
    seen.add(id);
  }
  return { ok: true };
}

/**
 * @desc EX-01: team assign/replace may only use booking.teamId.
 * @access Bookings domain
 */
export function assertTeamMatchesBooking(
  requestedTeamId: string,
  bookingTeamId: string | null,
): AssignmentPolicyResult {
  if (bookingTeamId === null || requestedTeamId !== bookingTeamId) {
    return { ok: false, code: "BOOKING_ASSIGNMENT_TEAM_MISMATCH" };
  }
  return { ok: true };
}

/**
 * @desc Composition: ≥1 cleans=true; escort/OTHER cannot clean; cleans=true must be CLEANING_STAFF.
 * @access Bookings domain
 */
export function assertAssignmentComposition(
  members: readonly AssignmentMemberInput[],
): AssignmentPolicyResult {
  if (members.length === 0) {
    return { ok: false, code: "BOOKING_ASSIGNMENT_COMPOSITION_INVALID" };
  }
  let cleansCount = 0;
  for (const member of members) {
    if (member.workerType === "ESCORT" && member.cleans) {
      return { ok: false, code: "BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN" };
    }
    if (member.workerType === "OTHER" && member.cleans) {
      return { ok: false, code: "BOOKING_ASSIGNMENT_COMPOSITION_INVALID" };
    }
    if (member.cleans) {
      if (member.workerType !== "CLEANING_STAFF") {
        return { ok: false, code: "BOOKING_ASSIGNMENT_COMPOSITION_INVALID" };
      }
      cleansCount += 1;
    }
  }
  if (cleansCount < 1) {
    return { ok: false, code: "BOOKING_ASSIGNMENT_COMPOSITION_INVALID" };
  }
  return { ok: true };
}

/**
 * @desc Crew preference over cleans=true genders only (escort ignored).
 * @access Bookings domain
 * @explanation Mirrors eligibility `matchesCrewPreference` for ALL_MALE/ALL_FEMALE/ANY.
 */
export function assertCrewPreference(
  preference: AssignmentCrewPreference,
  members: readonly AssignmentMemberInput[],
): AssignmentPolicyResult {
  const cleaners = members.filter((member) => member.cleans);
  const counts = {
    male: cleaners.filter((member) => member.gender === "male").length,
    female: cleaners.filter((member) => member.gender === "female").length,
    otherOrUnspecified: cleaners.filter(
      (member) => member.gender === "other_or_unspecified",
    ).length,
  };
  if (preference === "ANY") {
    return { ok: true };
  }
  const total = counts.male + counts.female + counts.otherOrUnspecified;
  if (total === 0) {
    return { ok: false, code: "BOOKING_ASSIGNMENT_CREW_MISMATCH" };
  }
  if (preference === "ALL_MALE") {
    if (counts.female === 0 && counts.otherOrUnspecified === 0 && counts.male > 0) {
      return { ok: true };
    }
    return { ok: false, code: "BOOKING_ASSIGNMENT_CREW_MISMATCH" };
  }
  if (counts.male === 0 && counts.otherOrUnspecified === 0 && counts.female > 0) {
    return { ok: true };
  }
  return { ok: false, code: "BOOKING_ASSIGNMENT_CREW_MISMATCH" };
}

/**
 * @desc WORKERS source must satisfy booking.requiredTeamUnits with cleans=true count.
 * @access Bookings domain
 */
export function assertRequiredTeamUnits(
  requiredTeamUnits: number,
  members: readonly AssignmentMemberInput[],
): AssignmentPolicyResult {
  if (!Number.isInteger(requiredTeamUnits) || requiredTeamUnits < 1) {
    return { ok: true };
  }
  const cleansCount = members.filter((member) => member.cleans).length;
  if (cleansCount < requiredTeamUnits) {
    return { ok: false, code: "BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS" };
  }
  return { ok: true };
}

/**
 * @desc Half-open interval overlap: startsAt < other.endsAt && endsAt > other.startsAt.
 * @access Bookings domain
 */
export function assignmentWindowsOverlap(
  left: { readonly startsAt: Date; readonly endsAt: Date },
  right: { readonly startsAt: Date; readonly endsAt: Date },
): boolean {
  return (
    left.startsAt.getTime() < right.endsAt.getTime() &&
    left.endsAt.getTime() > right.startsAt.getTime()
  );
}

/**
 * @desc Run all structural assignment policy checks for a candidate member set.
 * @access Bookings domain
 */
export function evaluateAssignmentMembers(input: {
  readonly members: readonly AssignmentMemberInput[];
  readonly crewPreference: AssignmentCrewPreference;
  readonly source: "TEAM" | "WORKERS";
  readonly requiredTeamUnits: number;
}): AssignmentPolicyResult {
  const ids = input.members.map((member) => member.workerId);
  const duplicates = rejectDuplicateWorkerIds(ids);
  if (!duplicates.ok) {
    return duplicates;
  }
  const composition = assertAssignmentComposition(input.members);
  if (!composition.ok) {
    return composition;
  }
  const crew = assertCrewPreference(input.crewPreference, input.members);
  if (!crew.ok) {
    return crew;
  }
  if (input.source === "WORKERS") {
    return assertRequiredTeamUnits(input.requiredTeamUnits, input.members);
  }
  return { ok: true };
}
