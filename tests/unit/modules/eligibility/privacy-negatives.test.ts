/**
 * Privacy negatives for Browse projection (R1-P11 Batch F / T040).
 */

import { mapDiagnosticToBrowseSafeProjection } from "#modules/eligibility/eligibility.service";
import type { DiagnosticResult, SortingFacts } from "#modules/eligibility/eligibility.public";
import { R1_P11_IDS } from "../../../helpers/r1-p11-eligibility-fixtures.js";

const sortingFacts: SortingFacts = {
  priceAmount: "50.00",
  minimumChargeAmount: "50.00",
  currencyCode: "EGP",
  priceUnitId: "u1",
  estimatedDurationMinutes: 90,
  matchingCapacityUnits: 1,
};

describe("Browse privacy negatives (T040)", () => {
  it("strips rejection reasons even when present on the diagnostic", () => {
    const diagnostic = {
      evaluationId: "e1",
      evaluationOutcomes: {
        catalog: {
          ruleId: "CATALOG_APPLICABILITY",
          status: "PASS",
          reasons: [],
        },
      },
      eligibleProviders: [],
      eligibleTeams: [
        {
          providerId: R1_P11_IDS.providerId,
          teamId: R1_P11_IDS.teamId,
          eligible: true,
          ruleOutcomes: [],
          reasons: [],
          sortingFacts,
        },
      ],
      excludedProviders: [
        {
          providerId: "secret-provider",
          eligible: false,
          ruleOutcomes: [
            {
              ruleId: "PERFORMANCE_GATE",
              status: "FAIL",
              reasons: ["PERFORMANCE_GATE_FAILED"],
            },
          ],
          reasons: ["PERFORMANCE_GATE_FAILED"],
          sortingFacts: null,
          qualifyingTeamCount: 0,
        },
      ],
      excludedTeams: [],
      metadata: {
        contractVersion: "eligibility.public.v1",
        engineVersion: "eligibility-engine.r1.v1",
        ruleVersionId: R1_P11_IDS.ruleVersionId,
        ruleChecksum: "c",
        requestHash: "r",
        evidenceHash: "e",
        resultHash: "x",
        evaluatedAt: "2026-09-09T12:00:00.000Z",
        countryTimeZone: "Africa/Cairo",
        calendarRuntimeVersion: "providers-availability-calendar.r1.v1",
        sourceVersions: {},
        discovery: {
          mode: "discovery",
          countryId: R1_P11_IDS.countryId,
          cityId: R1_P11_IDS.cityId,
          districtId: null,
          discoveredProviderCount: 1,
          evaluatedProviderCount: 1,
          teamResultCount: 1,
          complete: true,
        },
        limits: { maxProviders: 500, maxTeamResults: 5000 },
      },
    } satisfies DiagnosticResult;

    const projection = mapDiagnosticToBrowseSafeProjection(diagnostic);
    const json = JSON.stringify(projection);
    expect(json).not.toContain("PERFORMANCE_GATE_FAILED");
    expect(json).not.toContain("secret-provider");
    expect(json).not.toMatch(/workerId|memberIds|ownerUserId/iu);
  });
});
