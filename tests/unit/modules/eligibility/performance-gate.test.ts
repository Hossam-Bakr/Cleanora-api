import {
  evaluatePerformanceGateFromEvidence,
  fetchPerformanceEvidenceIfEnabled,
  parsePerformanceGateParameters,
} from "#modules/eligibility/eligibility.performance";
import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  buildPerformanceEvidence,
  createPerformanceEvidencePortDouble,
  R1_P11_IDS,
  R1_P11_TIMES,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";

const disabledGate = parsePerformanceGateParameters({
  enabled: false,
  metricKey: null,
  minimumThreshold: null,
  minimumSampleCount: null,
  maxEvidenceAgeSeconds: null,
});

const enabledGate = parsePerformanceGateParameters({
  enabled: true,
  metricKey: "completion_rate",
  minimumThreshold: "0.80",
  minimumSampleCount: 10,
  maxEvidenceAgeSeconds: 86_400,
});

describe("performance gate (Batch D / SC-003)", () => {
  it("returns NOT_APPLICABLE and never calls the port when disabled", async () => {
    const port = createPerformanceEvidencePortDouble();
    const fetched = await fetchPerformanceEvidenceIfEnabled({
      gate: disabledGate,
      port,
      providerId: R1_P11_IDS.providerId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      policyVersionId: R1_P11_IDS.ruleVersionId,
    });
    expect(fetched).toBeNull();
    expect(port.calls).toEqual([]);

    const outcome = evaluatePerformanceGateFromEvidence({
      gate: disabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      providerId: R1_P11_IDS.providerId,
      portResult: null,
    });
    expect(outcome.status).toBe("NOT_APPLICABLE");
    expect(outcome.reasons).toEqual([]);
  });

  it("cold-start MISSING ⇒ informational NOT_EVALUATED (not exclusion)", async () => {
    const port = createPerformanceEvidencePortDouble({
      result: { status: "MISSING" },
    });
    const fetched = await fetchPerformanceEvidenceIfEnabled({
      gate: enabledGate,
      port,
      providerId: R1_P11_IDS.providerId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      policyVersionId: R1_P11_IDS.ruleVersionId,
    });
    expect(port.calls).toHaveLength(1);

    const outcome = evaluatePerformanceGateFromEvidence({
      gate: enabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      providerId: R1_P11_IDS.providerId,
      portResult: fetched,
    });
    expect(outcome).toMatchObject({
      status: "NOT_EVALUATED",
      reasons: ["PERFORMANCE_EVIDENCE_MISSING"],
    });
  });

  it("insufficient samples and stale evidence are informational", () => {
    const insufficient = evaluatePerformanceGateFromEvidence({
      gate: enabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      providerId: R1_P11_IDS.providerId,
      portResult: {
        status: "OK",
        evidence: buildPerformanceEvidence({ sampleCount: 2 }),
      },
    });
    expect(insufficient.reasons).toEqual([
      "PERFORMANCE_EVIDENCE_INSUFFICIENT_SAMPLES",
    ]);
    expect(insufficient.status).toBe("NOT_EVALUATED");

    const stale = evaluatePerformanceGateFromEvidence({
      gate: enabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      providerId: R1_P11_IDS.providerId,
      portResult: {
        status: "OK",
        evidence: buildPerformanceEvidence({
          observedAt: "2026-09-01T00:00:00.000Z",
        }),
      },
    });
    expect(stale).toMatchObject({
      status: "NOT_EVALUATED",
      reasons: ["PERFORMANCE_EVIDENCE_STALE"],
    });
  });

  it("fails below threshold and passes above", () => {
    const failed = evaluatePerformanceGateFromEvidence({
      gate: enabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      providerId: R1_P11_IDS.providerId,
      portResult: {
        status: "OK",
        evidence: buildPerformanceEvidence({ value: "0.50" }),
      },
    });
    expect(failed).toMatchObject({
      status: "FAIL",
      reasons: ["PERFORMANCE_GATE_FAILED"],
    });

    const passed = evaluatePerformanceGateFromEvidence({
      gate: enabledGate,
      policyVersionId: R1_P11_IDS.ruleVersionId,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      providerId: R1_P11_IDS.providerId,
      portResult: {
        status: "OK",
        evidence: buildPerformanceEvidence({ value: "0.95" }),
      },
    });
    expect(passed.status).toBe("PASS");
  });

  it("rejects policyVersionId mismatch as technical integrity failure", () => {
    expect(() =>
      evaluatePerformanceGateFromEvidence({
        gate: enabledGate,
        policyVersionId: R1_P11_IDS.ruleVersionId,
        evaluatedAt: R1_P11_TIMES.evaluatedAt,
        providerId: R1_P11_IDS.providerId,
        portResult: {
          status: "OK",
          evidence: buildPerformanceEvidence({
            policyVersionId: "other-policy",
          }),
        },
      }),
    ).toThrow(EligibilityError);
  });
});
