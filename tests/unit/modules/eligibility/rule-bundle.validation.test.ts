/**
 * Rule-bundle validation before evaluation (Codex FAIL repair / DEC-082).
 */

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  computeEligibilityRuleContentChecksum,
  validateSelectedRuleBundle,
} from "#modules/eligibility/eligibility.rule-bundle";
import { ELIGIBILITY_RULE_ORDER } from "#modules/eligibility/eligibility.reasons";
import {
  computeR1P11EligibilityRuleContentChecksum,
  R1_P11_ELIGIBILITY_RULE_SEED,
} from "../../../../prisma/seed.js";

describe("validateSelectedRuleBundle", () => {
  const checksum = computeR1P11EligibilityRuleContentChecksum({
    schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
    engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
    ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
    parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
  });

  it("accepts the frozen seed bundle and matches seed checksum helper", () => {
    const parameters = validateSelectedRuleBundle({
      schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
      engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
      ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
      parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
      contentChecksum: checksum,
    });
    expect(parameters.maxProvidersPerEvaluation).toBe(500);
    expect(
      computeEligibilityRuleContentChecksum({
        schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
        engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
        ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
        parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
      }),
    ).toBe(checksum);
  });

  it("rejects schemaVersion mismatch", () => {
    expect(() =>
      validateSelectedRuleBundle({
        schemaVersion: "eligibility.rules.v0",
        engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
        ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
        parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
        contentChecksum: checksum,
      }),
    ).toThrow(EligibilityError);
  });

  it("rejects reordered or unknown rule IDs", () => {
    const reordered = [...ELIGIBILITY_RULE_ORDER].reverse();
    expect(() =>
      validateSelectedRuleBundle({
        schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
        engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
        ruleOrder: reordered,
        parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
        contentChecksum: checksum,
      }),
    ).toThrow(EligibilityError);

    expect(() =>
      validateSelectedRuleBundle({
        schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
        engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
        ruleOrder: [...ELIGIBILITY_RULE_ORDER.slice(0, 8), "UNKNOWN_RULE"],
        parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
        contentChecksum: checksum,
      }),
    ).toThrow(EligibilityError);
  });

  it("rejects malformed parameters previously ignored", () => {
    expect(() =>
      validateSelectedRuleBundle({
        schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
        engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
        ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
        parameters: {
          ...R1_P11_ELIGIBILITY_RULE_SEED.parameters,
          maxIntervalHours: 48,
        },
        contentChecksum: checksum,
      }),
    ).toThrow(EligibilityError);
  });

  it("rejects checksum drift", () => {
    expect(() =>
      validateSelectedRuleBundle({
        schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
        engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
        ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
        parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
        contentChecksum: "checksum",
      }),
    ).toThrow(EligibilityError);
  });

  it("rejects engine compatibility and malformed ruleOrder shapes", () => {
    const base = {
      schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
      engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
      ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
      parameters: R1_P11_ELIGIBILITY_RULE_SEED.parameters,
      contentChecksum: checksum,
    };
    expect(() =>
      validateSelectedRuleBundle({ ...base, engineCompatibility: "other" }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({ ...base, ruleOrder: "not-array" }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        ruleOrder: ELIGIBILITY_RULE_ORDER.slice(0, 8),
      }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        ruleOrder: [
          ELIGIBILITY_RULE_ORDER[0],
          ...ELIGIBILITY_RULE_ORDER.slice(1, -1),
          ELIGIBILITY_RULE_ORDER[0],
        ],
      }),
    ).toThrow(EligibilityError);
  });

  it("rejects closed-parameter mismatches and unknown keys", () => {
    const base = {
      schemaVersion: R1_P11_ELIGIBILITY_RULE_SEED.schemaVersion,
      engineCompatibility: R1_P11_ELIGIBILITY_RULE_SEED.engineCompatibility,
      ruleOrder: R1_P11_ELIGIBILITY_RULE_SEED.ruleOrder,
      contentChecksum: checksum,
    };
    const valid = R1_P11_ELIGIBILITY_RULE_SEED.parameters;
    expect(() =>
      validateSelectedRuleBundle({ ...base, parameters: null }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({ ...base, parameters: [] }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        parameters: { ...valid, extra: 1 },
      }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        parameters: { ...valid, maxProvidersPerEvaluation: 1 },
      }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        parameters: { ...valid, maxTeamResultsPerEvaluation: 1 },
      }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        parameters: { ...valid, minRequiredTeamUnits: 2 },
      }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        parameters: { ...valid, maxRequiredTeamUnits: 2 },
      }),
    ).toThrow(EligibilityError);
    expect(() =>
      validateSelectedRuleBundle({
        ...base,
        parameters: { ...valid, crewPreferences: ["any"] },
      }),
    ).toThrow(EligibilityError);
  });
});
