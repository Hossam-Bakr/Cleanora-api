
import {
  fingerprintWorkforceCommand,
  normalizeSkills,
  validateWorkerProfile,
} from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { createWorkerSchema } from "../../../src/modules/providers/provider-workforce.schema.js";

const validProfile = {
  fullLegalName: "R1-P07 Worker",
  gender: "FEMALE" as const,
  operationalPhoneE164: "+201012345678",
  workerType: "CLEANING_STAFF" as const,
  displayTitle: null,
  supervisorCapable: false,
  skills: ["Deep Cleaning"],
};

describe("R1-P07 Worker profile policy", () => {
  it("enforces domain bounds in addition to transport validation", () => {
    expect(() => validateWorkerProfile({ ...validProfile, fullLegalName: "x".repeat(201) })).toThrow("WORKFORCE_PROFILE_INVALID");
    expect(() => validateWorkerProfile({ ...validProfile, operationalPhoneE164: "+12" })).toThrow("WORKFORCE_PHONE_INVALID");
    expect(() => validateWorkerProfile({ ...validProfile, displayTitle: "   " })).toThrow("WORKFORCE_PROFILE_INVALID");
    expect(() => validateWorkerProfile({ ...validProfile, skills: Array.from({ length: 51 }, (_, index) => `skill-${index}`) })).toThrow("WORKFORCE_PROFILE_INVALID");
  });

  it("normalizes a skill set deterministically and rejects normalized duplicates", () => {
    expect(normalizeSkills(["  Deep   Cleaning  ", "Windows"])).toEqual([
      { displayLabel: "Deep Cleaning", normalizedLabel: "deep cleaning" },
      { displayLabel: "Windows", normalizedLabel: "windows" },
    ]);
    expect(() => normalizeSkills(["Windows", " windows "])).toThrow("WORKFORCE_SKILL_DUPLICATE");
  });

  it("matches the flat OpenAPI create input and rejects the obsolete nested shape", () => {
    const accepted = createWorkerSchema.parse({
      fullLegalName: "R1-P07 Worker",
      gender: "female",
      operationalPhoneE164: "+201012345678",
      workerType: "CLEANING_STAFF",
      displayTitle: null,
      supervisorCapable: false,
      skillTags: ["Deep Cleaning"],
      expectedVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000007",
    });
    expect(accepted.operationalPhoneE164).toBe("+201012345678");
    expect(() => createWorkerSchema.parse({
      profile: accepted,
      expectedProviderVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000007",
    })).toThrow();
  });

  it("creates a stable opaque fingerprint without copying sensitive inputs", () => {
    const first = fingerprintWorkforceCommand({ b: 2, a: validProfile });
    const retry = fingerprintWorkforceCommand({ a: validProfile, b: 2 });
    const changed = fingerprintWorkforceCommand({ a: { ...validProfile, operationalPhoneE164: "+201099999999" }, b: 2 });
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(retry).toBe(first);
    expect(changed).not.toBe(first);
    expect(first).not.toContain(validProfile.operationalPhoneE164);
  });
});
