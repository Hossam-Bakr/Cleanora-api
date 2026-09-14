import { describe, expect, it } from "vitest";
import {
  assertTeamMatchesBooking,
  assignmentWindowsOverlap,
  evaluateAssignmentMembers,
  type AssignmentMemberInput,
} from "#modules/bookings/bookings.assignment.policy";

const femaleCleaner: AssignmentMemberInput = {
  workerId: "w1",
  workerType: "CLEANING_STAFF",
  gender: "female",
  cleans: true,
};

const maleEscort: AssignmentMemberInput = {
  workerId: "w2",
  workerType: "ESCORT",
  gender: "male",
  cleans: false,
};

const maleCleaner: AssignmentMemberInput = {
  workerId: "w3",
  workerType: "CLEANING_STAFF",
  gender: "male",
  cleans: true,
};

describe("assignment policy", () => {
  it("rejects team id that differs from booking.teamId", () => {
    expect(assertTeamMatchesBooking("team-b", "team-a")).toEqual({
      ok: false,
      code: "BOOKING_ASSIGNMENT_TEAM_MISMATCH",
    });
  });

  it("accepts all-female crew with male escort", () => {
    expect(
      evaluateAssignmentMembers({
        members: [femaleCleaner, maleEscort],
        crewPreference: "ALL_FEMALE",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects male cleaner under ALL_FEMALE", () => {
    expect(
      evaluateAssignmentMembers({
        members: [maleCleaner],
        crewPreference: "ALL_FEMALE",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_CREW_MISMATCH" });
  });

  it("rejects escort with cleans=true", () => {
    expect(
      evaluateAssignmentMembers({
        members: [{ ...maleEscort, cleans: true }, femaleCleaner],
        crewPreference: "ANY",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN" });
  });

  it("rejects insufficient cleans units for ad-hoc assign", () => {
    expect(
      evaluateAssignmentMembers({
        members: [femaleCleaner],
        crewPreference: "ANY",
        source: "WORKERS",
        requiredTeamUnits: 2,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_INSUFFICIENT_UNITS" });
  });

  it("rejects duplicate workers and accepts ALL_MALE", () => {
    expect(
      evaluateAssignmentMembers({
        members: [maleCleaner, { ...maleCleaner, workerId: "w4" }],
        crewPreference: "ANY",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateAssignmentMembers({
        members: [maleCleaner, { ...maleCleaner }],
        crewPreference: "ANY",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_DUPLICATE_WORKER" });
    expect(
      evaluateAssignmentMembers({
        members: [maleCleaner],
        crewPreference: "ALL_MALE",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateAssignmentMembers({
        members: [femaleCleaner],
        crewPreference: "ALL_MALE",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_CREW_MISMATCH" });
    expect(
      evaluateAssignmentMembers({
        members: [
          {
            workerId: "w5",
            workerType: "CLEANING_STAFF",
            gender: "other_or_unspecified",
            cleans: true,
          },
        ],
        crewPreference: "ALL_FEMALE",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_CREW_MISMATCH" });
    expect(
      evaluateAssignmentMembers({
        members: [],
        crewPreference: "ANY",
        source: "TEAM",
        requiredTeamUnits: 1,
      }),
    ).toEqual({ ok: false, code: "BOOKING_ASSIGNMENT_COMPOSITION_INVALID" });
  });
});
