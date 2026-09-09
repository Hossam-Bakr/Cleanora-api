/**
 * R1-P11 evaluateEligibility integration (Batch E / T032, T034).
 * DB-gated via CLEANORA_R1_P11_DATABASE_URL.
 */

import { randomUUID } from "node:crypto";

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  ELIGIBILITY_MAX_PROVIDERS,
  validateEvaluateEligibilityRequest,
} from "#modules/eligibility/eligibility.service";
import {
  buildDiscoveryRequest,
  hasExplicitR1P11TestDatabase,
} from "../../helpers/r1-p11-eligibility-fixtures.js";
import {
  createR1P11EligibilityLiveHarness,
  type R1P11EligibilityLiveHarness,
} from "../../helpers/r1-p11-eligibility-live.js";

const live = hasExplicitR1P11TestDatabase();

describe.skipIf(!live)("R1-P11 evaluateEligibility (live composed)", () => {
  let h: R1P11EligibilityLiveHarness;

  beforeAll(async () => {
    h = await createR1P11EligibilityLiveHarness();
  });

  afterAll(async () => {
    await h?.close();
  });

  it("evaluates a real P09/P10-backed Provider as eligible on discovery", async () => {
    const result = await h.eligibility.evaluateEligibility({
      mode: "discovery",
      ...h.requestBase,
    });

    expect(result.evaluationOutcomes.catalog.status).toBe("PASS");
    expect(result.eligibleTeams.some((team) => team.teamId === h.team.id)).toBe(
      true,
    );
    expect(result.eligibleProviders.some((row) => row.providerId === h.provider.id)).toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toMatch(/workerId/u);

    const persisted = await h.db.eligibilityEvaluation.findUniqueOrThrow({
      where: { id: result.evaluationId },
      include: { candidateResults: true },
    });
    expect(persisted.candidateResults.length).toBeGreaterThan(0);
    expect(JSON.stringify(persisted.evidenceSafe)).not.toMatch(/workerId/u);
  });

  it("persists Catalog FAIL with zero Providers for an unknown service", async () => {
    const result = await h.eligibility.evaluateEligibility({
      mode: "discovery",
      ...h.requestBase,
      serviceId: randomUUID(),
    });

    expect(result.evaluationOutcomes.catalog.status).toBe("FAIL");
    expect(result.eligibleProviders).toEqual([]);
    expect(result.eligibleTeams).toEqual([]);
    const persisted = await h.db.eligibilityEvaluation.findUnique({
      where: { id: result.evaluationId },
    });
    expect(persisted).not.toBeNull();
  });

  it("stores a Provider summary for an explicit nonexistent Provider ID", async () => {
    const missingId = randomUUID();
    const result = await h.eligibility.evaluateEligibility({
      mode: "explicit",
      ...h.requestBase,
      providerIds: [missingId],
    });
    expect(result.excludedProviders.some((row) => row.providerId === missingId)).toBe(
      true,
    );
    const summaries = await h.db.eligibilityCandidateResult.findMany({
      where: { evaluationId: result.evaluationId, providerId: missingId },
    });
    expect(summaries.length).toBeGreaterThan(0);
  });

  it("returns EVALUATION_LIMIT_EXCEEDED for 501 explicit Provider IDs", async () => {
    const providerIds = Array.from(
      { length: ELIGIBILITY_MAX_PROVIDERS + 1 },
      () => randomUUID(),
    );
    await expect(
      h.eligibility.evaluateEligibility({
        mode: "explicit",
        ...h.requestBase,
        providerIds,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof EligibilityError &&
        error.code === "EVALUATION_LIMIT_EXCEEDED"
      );
    });
  });
});

describe("R1-P11 evaluateEligibility validation (always on)", () => {
  it("accepts fixture discovery requests", () => {
    expect(() =>
      validateEvaluateEligibilityRequest(buildDiscoveryRequest()),
    ).not.toThrow();
  });
});
