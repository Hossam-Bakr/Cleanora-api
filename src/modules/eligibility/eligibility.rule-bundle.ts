/**
 * Frozen Eligibility rule-bundle validation (R1-P11 / DEC-082, DEC-084).
 */

import { EligibilityError } from "./eligibility.errors.js";
import { eligibilitySha256 } from "./eligibility.hashes.js";
import {
  ELIGIBILITY_RULE_ORDER,
  isEligibilityRuleId,
} from "./eligibility.reasons.js";
import {
  parsePerformanceGateParameters,
  type PerformanceGateParameters,
} from "./eligibility.performance.js";
import { ELIGIBILITY_ENGINE_COMPATIBILITY } from "./infrastructure/prisma-eligibility.repository.js";

export const ELIGIBILITY_RULE_SCHEMA_VERSION = "eligibility.rules.v1" as const;
export const ELIGIBILITY_MAX_PROVIDERS = 500 as const;
export const ELIGIBILITY_MAX_TEAMS = 5000 as const;
export const ELIGIBILITY_MAX_INTERVAL_HOURS = 24 as const;
export const ELIGIBILITY_MIN_REQUIRED_TEAM_UNITS = 1 as const;
export const ELIGIBILITY_MAX_REQUIRED_TEAM_UNITS = 50 as const;
export const ELIGIBILITY_CREW_PREFERENCES = [
  "all_male",
  "all_female",
  "any",
] as const;

export type ValidatedRuleParameters = {
  readonly maxProvidersPerEvaluation: typeof ELIGIBILITY_MAX_PROVIDERS;
  readonly maxTeamResultsPerEvaluation: typeof ELIGIBILITY_MAX_TEAMS;
  readonly maxIntervalHours: typeof ELIGIBILITY_MAX_INTERVAL_HOURS;
  readonly minRequiredTeamUnits: typeof ELIGIBILITY_MIN_REQUIRED_TEAM_UNITS;
  readonly maxRequiredTeamUnits: typeof ELIGIBILITY_MAX_REQUIRED_TEAM_UNITS;
  readonly crewPreferences: readonly (typeof ELIGIBILITY_CREW_PREFERENCES)[number][];
  readonly performanceGate: PerformanceGateParameters;
};

/**
 * @desc Canonical SHA-256 of schemaVersion + engineCompatibility + ruleOrder + parameters.
 * @access Domain
 */
export function computeEligibilityRuleContentChecksum(input: {
  readonly schemaVersion: string;
  readonly engineCompatibility: string;
  readonly ruleOrder: unknown;
  readonly parameters: unknown;
}): string {
  return eligibilitySha256({
    schemaVersion: input.schemaVersion,
    engineCompatibility: input.engineCompatibility,
    ruleOrder: input.ruleOrder,
    parameters: input.parameters,
  });
}

function assertExactRuleOrder(ruleOrder: unknown): void {
  if (!Array.isArray(ruleOrder)) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "ruleOrder", reason: "NOT_ARRAY" },
    });
  }
  if (ruleOrder.length !== ELIGIBILITY_RULE_ORDER.length) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "ruleOrder", reason: "LENGTH_MISMATCH" },
    });
  }
  const seen = new Set<string>();
  for (let index = 0; index < ELIGIBILITY_RULE_ORDER.length; index += 1) {
    const entry = ruleOrder[index];
    if (typeof entry !== "string" || !isEligibilityRuleId(entry)) {
      throw new EligibilityError("RULE_VERSION_INVALID", {
        details: { field: "ruleOrder", reason: "UNKNOWN_OR_INVALID_RULE_ID", index },
      });
    }
    if (seen.has(entry)) {
      throw new EligibilityError("RULE_VERSION_INVALID", {
        details: { field: "ruleOrder", reason: "DUPLICATE_RULE_ID", ruleId: entry },
      });
    }
    seen.add(entry);
    if (entry !== ELIGIBILITY_RULE_ORDER[index]) {
      throw new EligibilityError("RULE_VERSION_INVALID", {
        details: {
          field: "ruleOrder",
          reason: "ORDER_MISMATCH",
          index,
          expected: ELIGIBILITY_RULE_ORDER[index],
          actual: entry,
        },
      });
    }
  }
}

function parseClosedParameters(raw: unknown): ValidatedRuleParameters {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters" },
    });
  }
  const record = raw as Record<string, unknown>;
  const allowedKeys = new Set([
    "maxProvidersPerEvaluation",
    "maxTeamResultsPerEvaluation",
    "maxIntervalHours",
    "minRequiredTeamUnits",
    "maxRequiredTeamUnits",
    "crewPreferences",
    "performanceGate",
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new EligibilityError("RULE_VERSION_INVALID", {
        details: { field: "parameters", reason: "UNKNOWN_KEY", key },
      });
    }
  }

  const performanceGate = parsePerformanceGateParameters(
    record["performanceGate"],
  );
  if (record["maxProvidersPerEvaluation"] !== ELIGIBILITY_MAX_PROVIDERS) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters.maxProvidersPerEvaluation" },
    });
  }
  if (record["maxTeamResultsPerEvaluation"] !== ELIGIBILITY_MAX_TEAMS) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters.maxTeamResultsPerEvaluation" },
    });
  }
  if (record["maxIntervalHours"] !== ELIGIBILITY_MAX_INTERVAL_HOURS) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters.maxIntervalHours" },
    });
  }
  if (record["minRequiredTeamUnits"] !== ELIGIBILITY_MIN_REQUIRED_TEAM_UNITS) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters.minRequiredTeamUnits" },
    });
  }
  if (record["maxRequiredTeamUnits"] !== ELIGIBILITY_MAX_REQUIRED_TEAM_UNITS) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters.maxRequiredTeamUnits" },
    });
  }
  const crewPreferences = record["crewPreferences"];
  if (
    !Array.isArray(crewPreferences) ||
    crewPreferences.length !== ELIGIBILITY_CREW_PREFERENCES.length ||
    !ELIGIBILITY_CREW_PREFERENCES.every(
      (value, index) => crewPreferences[index] === value,
    )
  ) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "parameters.crewPreferences" },
    });
  }

  return {
    maxProvidersPerEvaluation: ELIGIBILITY_MAX_PROVIDERS,
    maxTeamResultsPerEvaluation: ELIGIBILITY_MAX_TEAMS,
    maxIntervalHours: ELIGIBILITY_MAX_INTERVAL_HOURS,
    minRequiredTeamUnits: ELIGIBILITY_MIN_REQUIRED_TEAM_UNITS,
    maxRequiredTeamUnits: ELIGIBILITY_MAX_REQUIRED_TEAM_UNITS,
    crewPreferences: [...ELIGIBILITY_CREW_PREFERENCES],
    performanceGate,
  };
}

/**
 * @desc Validate a selected rule-version row before Catalog/candidate reads.
 * @access Application
 */
export function validateSelectedRuleBundle(input: {
  readonly schemaVersion: string;
  readonly engineCompatibility: string;
  readonly ruleOrder: unknown;
  readonly parameters: unknown;
  readonly contentChecksum: string;
}): ValidatedRuleParameters {
  if (input.schemaVersion !== ELIGIBILITY_RULE_SCHEMA_VERSION) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "schemaVersion" },
    });
  }
  if (input.engineCompatibility !== ELIGIBILITY_ENGINE_COMPATIBILITY) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "engineCompatibility" },
    });
  }
  assertExactRuleOrder(input.ruleOrder);
  const parameters = parseClosedParameters(input.parameters);
  const expectedChecksum = computeEligibilityRuleContentChecksum({
    schemaVersion: input.schemaVersion,
    engineCompatibility: input.engineCompatibility,
    ruleOrder: input.ruleOrder,
    parameters: input.parameters,
  });
  if (expectedChecksum !== input.contentChecksum) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "contentChecksum", reason: "CHECKSUM_MISMATCH" },
    });
  }
  return parameters;
}
