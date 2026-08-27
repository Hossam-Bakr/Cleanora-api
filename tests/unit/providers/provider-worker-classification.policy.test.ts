
import {
  assertCleanerToEscortAllowed,
  normalizeSkills,
  validateWorkerProfile,
} from "../../../src/modules/providers/domain/provider-workforce.policy.js";

const profile = {
  fullLegalName: "Worker Name",
  gender: "FEMALE" as const,
  operationalPhoneE164: "+201011111111",
  workerType: "CLEANING_STAFF" as const,
  displayTitle: null,
  supervisorCapable: false,
  skills: [] as readonly string[],
};

describe("Worker classification and skills", () => {
  it.each([
    ["CLEANING_STAFF", false],
    ["CLEANING_STAFF", true],
    ["ESCORT", false],
    ["ESCORT", true],
    ["OTHER", false],
    ["OTHER", true],
  ] as const)("keeps Worker type %s independent from Supervisor capability %s", (workerType, supervisorCapable) => {
    expect(() => validateWorkerProfile({ ...profile, workerType, supervisorCapable })).not.toThrow();
  });

  it("normalizes skill labels deterministically and rejects normalized duplicates", () => {
    expect(normalizeSkills([" Deep   Cleaning ", "Window Care"])).toEqual([
      { displayLabel: "Deep Cleaning", normalizedLabel: "deep cleaning" },
      { displayLabel: "Window Care", normalizedLabel: "window care" },
    ]);
    expect(() => normalizeSkills(["Deep Cleaning", " deep   cleaning "]))
      .toThrowError(expect.objectContaining({ code: "WORKFORCE_SKILL_DUPLICATE" }));
  });

  it("requires the membership cleans correction before Cleaner-to-Escort", () => {
    expect(() => assertCleanerToEscortAllowed("ESCORT", true))
      .toThrowError(expect.objectContaining({ code: "WORKFORCE_ESCORT_MEMBERSHIP_CONFLICT" }));
    expect(() => assertCleanerToEscortAllowed("ESCORT", false)).not.toThrow();
  });
});
