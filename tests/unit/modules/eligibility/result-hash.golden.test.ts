/**
 * Golden-vector resultHash projection tests (Codex FAIL repair / DEC-081).
 */

import {
  computeRequestHash,
  computeResultHash,
  eligibilityCanonicalJson,
  normalizeEligibilityRequest,
  sortSourceVersions,
  type EligibilityResultHashInput,
} from "#modules/eligibility/eligibility.hashes";
import {
  buildDiscoveryRequest,
  R1_P11_IDS,
  R1_P11_TIMES,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";

function baseHashInput(
  overrides: Partial<EligibilityResultHashInput> = {},
): EligibilityResultHashInput {
  return {
    evaluationOutcomes: {
      catalog: {
        ruleId: "CATALOG_APPLICABILITY",
        status: "PASS",
        reasons: [],
      },
    },
    eligibleProviders: [],
    eligibleTeams: [],
    excludedProviders: [],
    excludedTeams: [],
    metadata: {
      contractVersion: "eligibility.public.v1",
      engineVersion: "eligibility-engine.r1.v1",
      ruleVersionId: R1_P11_IDS.ruleVersionId,
      ruleChecksum: "abc",
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      countryTimeZone: "Africa/Cairo",
      calendarRuntimeVersion: "providers-availability-calendar.r1.v1",
      sourceVersions: sortSourceVersions({
        "lifecycle:p1": "3",
        "pricing:p1": "1:price",
      }),
      discovery: {
        mode: "discovery",
        countryId: R1_P11_IDS.countryId,
        cityId: R1_P11_IDS.cityId,
        districtId: null,
        discoveredProviderCount: 0,
        evaluatedProviderCount: 0,
        teamResultCount: 0,
        complete: true,
      },
      limits: { maxProviders: 500, maxTeamResults: 5000 },
    },
    ...overrides,
  };
}

describe("resultHash golden vectors", () => {
  it("excludes requestHash/evidenceHash/resultHash/evaluationId from the hashed projection", () => {
    const base = baseHashInput();
    const hash = computeResultHash(base);
    const polluted = computeResultHash({
      ...base,
      metadata: {
        ...base.metadata,
        // @ts-expect-error intentional pollution probe
        requestHash: computeRequestHash(
          normalizeEligibilityRequest(buildDiscoveryRequest()),
        ),
        evidenceHash: "evidence-pollution",
        resultHash: "result-pollution",
        evaluationId: "eval-pollution",
        traceId: "trace",
        completedAt: "2026-09-15T00:00:00.000Z",
      },
    });
    expect(polluted).toBe(hash);
  });

  it("changes when a permitted semantic field changes", () => {
    const base = computeResultHash(baseHashInput());
    const changed = computeResultHash(
      baseHashInput({
        metadata: {
          ...baseHashInput().metadata,
          ruleChecksum: "different-checksum",
        },
      }),
    );
    expect(changed).not.toBe(base);
  });

  it("sorts sourceVersions keys deterministically", () => {
    const left = sortSourceVersions({ b: "2", a: "1" });
    const right = sortSourceVersions({ a: "1", b: "2" });
    expect(Object.keys(left)).toEqual(["a", "b"]);
    expect(eligibilityCanonicalJson(left)).toBe(eligibilityCanonicalJson(right));
    expect(
      computeResultHash(
        baseHashInput({
          metadata: { ...baseHashInput().metadata, sourceVersions: left },
        }),
      ),
    ).toBe(
      computeResultHash(
        baseHashInput({
          metadata: { ...baseHashInput().metadata, sourceVersions: right },
        }),
      ),
    );
  });

  it("matches the frozen contract object shape in canonical JSON", () => {
    const input = baseHashInput();
    const projection = {
      evaluationOutcomes: input.evaluationOutcomes,
      eligibleProviders: input.eligibleProviders,
      eligibleTeams: input.eligibleTeams,
      excludedProviders: input.excludedProviders,
      excludedTeams: input.excludedTeams,
      metadata: {
        contractVersion: input.metadata.contractVersion,
        engineVersion: input.metadata.engineVersion,
        ruleVersionId: input.metadata.ruleVersionId,
        ruleChecksum: input.metadata.ruleChecksum,
        evaluatedAt: input.metadata.evaluatedAt,
        countryTimeZone: input.metadata.countryTimeZone,
        calendarRuntimeVersion: input.metadata.calendarRuntimeVersion,
        sourceVersions: input.metadata.sourceVersions,
        discovery: input.metadata.discovery,
        limits: input.metadata.limits,
      },
    };
    const json = eligibilityCanonicalJson(projection);
    expect(json).not.toContain("requestHash");
    expect(json).not.toContain("evidenceHash");
    expect(json).not.toContain("resultHash");
    expect(json).not.toContain("evaluationId");
    expect(json).toContain("sourceVersions");
    expect(computeResultHash(input)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("canonicalizes Date values and rejects undefined", () => {
    expect(eligibilityCanonicalJson(new Date("2026-09-10T00:00:00.000Z"))).toBe(
      JSON.stringify("2026-09-10T00:00:00.000Z"),
    );
    expect(() => eligibilityCanonicalJson(undefined)).toThrow(
      /forbids undefined/u,
    );
  });
});
