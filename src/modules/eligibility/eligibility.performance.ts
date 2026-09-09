/**
 * Performance gate policy (R1-P11 / DEC-068, DEC-080, DEC-084).
 *
 * Disabled ⇒ NOT_APPLICABLE and port not called. Enabled paths compare evidence
 * owned by Eligibility (samples, freshness, threshold).
 */

import { EligibilityError } from "./eligibility.errors.js";
import type { RuleOutcome } from "./eligibility.public.js";
import type {
  PerformanceEvidence,
  PerformanceEvidencePort,
  PerformanceEvidenceResult,
} from "./performance-evidence.port.js";

export type {
  PerformanceEvidence,
  PerformanceEvidencePort,
  PerformanceEvidenceResult,
} from "./performance-evidence.port.js";

/** Pinned performance-gate parameters from an immutable rule bundle. */
export type PerformanceGateParameters =
  | {
      readonly enabled: false;
      readonly metricKey: null;
      readonly minimumThreshold: null;
      readonly minimumSampleCount: null;
      readonly maxEvidenceAgeSeconds: null;
    }
  | {
      readonly enabled: true;
      readonly metricKey: string;
      readonly minimumThreshold: string;
      readonly minimumSampleCount: number;
      readonly maxEvidenceAgeSeconds: number;
    };

/**
 * @desc Validate enabled-gate parameter shapes (RULE_VERSION_INVALID otherwise).
 * @access Domain
 */
export function parsePerformanceGateParameters(
  raw: unknown,
): PerformanceGateParameters {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "performanceGate", reason: "NOT_OBJECT" },
    });
  }
  const record = raw as Record<string, unknown>;
  if (record["enabled"] === false) {
    return {
      enabled: false,
      metricKey: null,
      minimumThreshold: null,
      minimumSampleCount: null,
      maxEvidenceAgeSeconds: null,
    };
  }
  if (record["enabled"] !== true) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "performanceGate.enabled" },
    });
  }
  const metricKey = record["metricKey"];
  const minimumThreshold = record["minimumThreshold"];
  const minimumSampleCount = record["minimumSampleCount"];
  const maxEvidenceAgeSeconds = record["maxEvidenceAgeSeconds"];
  if (typeof metricKey !== "string" || metricKey.length === 0) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "performanceGate.metricKey" },
    });
  }
  if (typeof minimumThreshold !== "string" || minimumThreshold.length === 0) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "performanceGate.minimumThreshold" },
    });
  }
  if (
    typeof minimumSampleCount !== "number" ||
    !Number.isInteger(minimumSampleCount) ||
    minimumSampleCount < 1
  ) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "performanceGate.minimumSampleCount" },
    });
  }
  if (
    typeof maxEvidenceAgeSeconds !== "number" ||
    !Number.isInteger(maxEvidenceAgeSeconds) ||
    maxEvidenceAgeSeconds < 1
  ) {
    throw new EligibilityError("RULE_VERSION_INVALID", {
      details: { field: "performanceGate.maxEvidenceAgeSeconds" },
    });
  }
  return {
    enabled: true,
    metricKey,
    minimumThreshold,
    minimumSampleCount,
    maxEvidenceAgeSeconds,
  };
}

function parseCanonicalDecimal(value: string): number {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field: "performance.value", reason: "MALFORMED_DECIMAL" },
    });
  }
  return Number(value);
}

function parseUtcInstant(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString() !== value) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field, reason: "INVALID_UTC_INSTANT" },
    });
  }
  return parsed;
}

/**
 * @desc Evaluate PERFORMANCE_GATE without calling the port when disabled.
 * @access Domain
 * @explanation Cold-start / missing / stale / insufficient ⇒ informational
 * NOT_EVALUATED (not exclusion). Below threshold ⇒ FAIL PERFORMANCE_GATE_FAILED.
 */
export function evaluatePerformanceGateFromEvidence(input: {
  readonly gate: PerformanceGateParameters;
  readonly policyVersionId: string;
  readonly evaluatedAt: string;
  readonly providerId: string;
  readonly portResult: PerformanceEvidenceResult | null;
}): RuleOutcome & {
  readonly evidenceForSnapshot:
    | { readonly status: "NOT_APPLICABLE" }
    | { readonly status: "MISSING" }
    | {
        readonly status: "OK";
        readonly metricKey: string;
        readonly policyVersionId: string;
        readonly value: string;
        readonly sampleCount: number;
        readonly observedAt: string;
      };
} {
  if (!input.gate.enabled) {
    if (input.portResult !== null) {
      throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
        details: {
          reason: "PERFORMANCE_PORT_CALLED_WHILE_DISABLED",
        },
      });
    }
    return {
      ruleId: "PERFORMANCE_GATE",
      status: "NOT_APPLICABLE",
      reasons: [],
      evidenceForSnapshot: { status: "NOT_APPLICABLE" },
    };
  }

  if (input.portResult === null) {
    throw new EligibilityError("DEPENDENCY_FAILURE", {
      details: { reason: "PERFORMANCE_PORT_RESULT_REQUIRED" },
    });
  }

  if (input.portResult.status === "MISSING") {
    return {
      ruleId: "PERFORMANCE_GATE",
      status: "NOT_EVALUATED",
      reasons: ["PERFORMANCE_EVIDENCE_MISSING"],
      evidenceForSnapshot: { status: "MISSING" },
    };
  }

  const evidence = input.portResult.evidence;
  assertEvidenceIntegrity({
    evidence,
    providerId: input.providerId,
    policyVersionId: input.policyVersionId,
    metricKey: input.gate.metricKey,
  });

  if (evidence.sampleCount < input.gate.minimumSampleCount) {
    return {
      ruleId: "PERFORMANCE_GATE",
      status: "NOT_EVALUATED",
      reasons: ["PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES"],
      evidenceForSnapshot: toOkSnapshot(evidence),
    };
  }

  const evaluatedAtMs = parseUtcInstant(input.evaluatedAt, "evaluatedAt");
  const observedAtMs = parseUtcInstant(evidence.observedAt, "observedAt");
  if (observedAtMs > evaluatedAtMs) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field: "observedAt", reason: "FUTURE_DATED" },
    });
  }
  const ageSeconds = Math.floor((evaluatedAtMs - observedAtMs) / 1000);
  if (ageSeconds > input.gate.maxEvidenceAgeSeconds) {
    return {
      ruleId: "PERFORMANCE_GATE",
      status: "NOT_EVALUATED",
      reasons: ["PERFORMANCE_EVIDENCE_STALE"],
      evidenceForSnapshot: toOkSnapshot(evidence),
    };
  }

  const value = parseCanonicalDecimal(evidence.value);
  const threshold = parseCanonicalDecimal(input.gate.minimumThreshold);
  if (value < threshold) {
    return {
      ruleId: "PERFORMANCE_GATE",
      status: "FAIL",
      reasons: ["PERFORMANCE_GATE_FAILED"],
      evidenceForSnapshot: toOkSnapshot(evidence),
    };
  }

  return {
    ruleId: "PERFORMANCE_GATE",
    status: "PASS",
    reasons: [],
    evidenceForSnapshot: toOkSnapshot(evidence),
  };
}

function toOkSnapshot(evidence: PerformanceEvidence): {
  readonly status: "OK";
  readonly metricKey: string;
  readonly policyVersionId: string;
  readonly value: string;
  readonly sampleCount: number;
  readonly observedAt: string;
} {
  return {
    status: "OK",
    metricKey: evidence.metricKey,
    policyVersionId: evidence.policyVersionId,
    value: evidence.value,
    sampleCount: evidence.sampleCount,
    observedAt: evidence.observedAt,
  };
}

function assertEvidenceIntegrity(input: {
  readonly evidence: PerformanceEvidence;
  readonly providerId: string;
  readonly policyVersionId: string;
  readonly metricKey: string;
}): void {
  if (input.evidence.providerId !== input.providerId) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field: "providerId", reason: "MISMATCH" },
    });
  }
  if (input.evidence.policyVersionId !== input.policyVersionId) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field: "policyVersionId", reason: "MISMATCH" },
    });
  }
  if (input.evidence.metricKey !== input.metricKey) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field: "metricKey", reason: "MISMATCH" },
    });
  }
  if (
    !Number.isInteger(input.evidence.sampleCount) ||
    input.evidence.sampleCount < 0
  ) {
    throw new EligibilityError("INVALID_DEPENDENCY_DTO", {
      details: { field: "sampleCount", reason: "INVALID" },
    });
  }
}

/**
 * @desc Call the performance port only when the gate is enabled.
 * @access Application helper
 * @explanation Disabled gate never invokes the port (DEC-080 / DEC-084).
 */
export async function fetchPerformanceEvidenceIfEnabled(input: {
  readonly gate: PerformanceGateParameters;
  readonly port: PerformanceEvidencePort | undefined;
  readonly providerId: string;
  readonly evaluatedAt: string;
  readonly policyVersionId: string;
}): Promise<PerformanceEvidenceResult | null> {
  if (!input.gate.enabled) {
    return null;
  }
  if (input.port === undefined) {
    throw new EligibilityError("DEPENDENCY_FAILURE", {
      details: { reason: "PERFORMANCE_PORT_REQUIRED_WHEN_ENABLED" },
    });
  }
  return input.port.getEvidence({
    providerId: input.providerId,
    metricKey: input.gate.metricKey,
    asOf: input.evaluatedAt,
    policyVersionId: input.policyVersionId,
  });
}
