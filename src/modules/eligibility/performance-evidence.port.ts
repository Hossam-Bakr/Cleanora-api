/**
 * Trusted performance evidence port (R1-P11 / DEC-084).
 *
 * Port returns complete evidence or MISSING only. Sample count, freshness, and
 * threshold comparison belong to Eligibility (`eligibility.performance.ts`).
 */

export interface PerformanceEvidence {
  readonly providerId: string;
  readonly metricKey: string;
  /** Must match the selected rule-version / policy identity. */
  readonly policyVersionId: string;
  /** Canonical decimal string. */
  readonly value: string;
  readonly sampleCount: number;
  /** Instant UTC ISO-8601. */
  readonly observedAt: string;
}

/** Port returns OK|MISSING only; technical failures reject the Promise. */
export type PerformanceEvidenceResult =
  | { readonly status: "OK"; readonly evidence: PerformanceEvidence }
  | { readonly status: "MISSING" };

export interface PerformanceEvidencePort {
  getEvidence(input: {
    readonly providerId: string;
    readonly metricKey: string;
    /** Captured evaluatedAt. */
    readonly asOf: string;
    readonly policyVersionId: string;
  }): Promise<PerformanceEvidenceResult>;
}
