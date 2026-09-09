/**
 * Browse-safe projection privacy + mapping (R1-P11 Batch F / T039–T042).
 */

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  mapDiagnosticToBrowseSafeProjection,
  validateBrowseCandidatesRequest,
} from "#modules/eligibility/eligibility.service";
import type {
  DiagnosticResult,
  SortingFacts,
} from "#modules/eligibility/eligibility.public";
import {
  buildBrowseCandidatesRequest,
  R1_P11_IDS,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sortingFacts: SortingFacts = {
  priceAmount: "120.00",
  minimumChargeAmount: "100.00",
  currencyCode: "EGP",
  priceUnitId: "unit-1",
  estimatedDurationMinutes: 60,
  matchingCapacityUnits: 2,
};

function buildDiagnostic(overrides: {
  readonly eligibleTeams?: DiagnosticResult["eligibleTeams"];
  readonly excludedProviders?: DiagnosticResult["excludedProviders"];
  readonly excludedTeams?: DiagnosticResult["excludedTeams"];
} = {}): DiagnosticResult {
  return {
    evaluationId: R1_P11_IDS.evaluationId,
    evaluationOutcomes: {
      catalog: {
        ruleId: "CATALOG_APPLICABILITY",
        status: "PASS",
        reasons: [],
      },
    },
    eligibleProviders: [
      {
        providerId: R1_P11_IDS.providerId,
        eligible: true,
        ruleOutcomes: [],
        reasons: [],
        sortingFacts,
        qualifyingTeamCount: 1,
      },
    ],
    eligibleTeams:
      overrides.eligibleTeams ??
      ([
        {
          providerId: R1_P11_IDS.providerId,
          teamId: R1_P11_IDS.teamId,
          eligible: true,
          ruleOutcomes: [],
          reasons: [],
          sortingFacts,
        },
      ] as const),
    excludedProviders:
      overrides.excludedProviders ??
      ([
        {
          providerId: R1_P11_IDS.otherProviderId,
          eligible: false,
          ruleOutcomes: [
            {
              ruleId: "PROVIDER_APPROVAL_VERIFICATION_LIVE",
              status: "FAIL",
              reasons: ["PROVIDER_NOT_APPROVED"],
            },
          ],
          reasons: ["PROVIDER_NOT_APPROVED"],
          sortingFacts: null,
          qualifyingTeamCount: 0,
        },
      ] as const),
    excludedTeams:
      overrides.excludedTeams ??
      ([
        {
          providerId: R1_P11_IDS.otherProviderId,
          teamId: "excluded-team",
          eligible: false,
          ruleOutcomes: [],
          reasons: ["NO_VALID_COMPLETE_TEAM"],
          sortingFacts: null,
        },
      ] as const),
    metadata: {
      contractVersion: "eligibility.public.v1",
      engineVersion: "eligibility-engine.r1.v1",
      ruleVersionId: R1_P11_IDS.ruleVersionId,
      ruleChecksum: "checksum",
      requestHash: "req",
      evidenceHash: "ev",
      resultHash: "res",
      evaluatedAt: "2026-09-09T12:00:00.000Z",
      countryTimeZone: "Africa/Cairo",
      calendarRuntimeVersion: "providers-availability-calendar.r1.v1",
      sourceVersions: {},
      discovery: {
        mode: "discovery",
        countryId: R1_P11_IDS.countryId,
        cityId: R1_P11_IDS.cityId,
        districtId: R1_P11_IDS.districtId,
        discoveredProviderCount: 2,
        evaluatedProviderCount: 2,
        teamResultCount: 2,
        complete: true,
      },
      limits: { maxProviders: 500, maxTeamResults: 5000 },
    },
  };
}

describe("Browse-safe projection (T039)", () => {
  it("maps only eligible teams with sortingFacts into candidates", () => {
    const projection = mapDiagnosticToBrowseSafeProjection(buildDiagnostic());
    expect(projection.candidates).toEqual([
      {
        providerId: R1_P11_IDS.providerId,
        teamId: R1_P11_IDS.teamId,
        sortingFacts,
      },
    ]);
    expect(projection.metadata.requestHash).toBe("req");
    expect(projection.metadata.discovery.mode).toBe("discovery");
  });

  it("omits excluded providers/teams and rejection diagnostics", () => {
    const projection = mapDiagnosticToBrowseSafeProjection(buildDiagnostic());
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("PROVIDER_NOT_APPROVED");
    expect(serialized).not.toContain("NO_VALID_COMPLETE_TEAM");
    expect(serialized).not.toContain(R1_P11_IDS.otherProviderId);
    expect(serialized).not.toContain("excluded-team");
    expect(serialized).not.toContain("excludedProviders");
    expect(serialized).not.toContain("ruleOutcomes");
  });

  it("never embeds Worker IDs in the safe projection", () => {
    const projection = mapDiagnosticToBrowseSafeProjection(buildDiagnostic());
    expect(JSON.stringify(projection)).not.toMatch(/workerId/iu);
  });

  it("orders candidates by providerId then teamId", () => {
    const projection = mapDiagnosticToBrowseSafeProjection(
      buildDiagnostic({
        eligibleTeams: [
          {
            providerId: "p-b",
            teamId: "t-2",
            eligible: true,
            ruleOutcomes: [],
            reasons: [],
            sortingFacts,
          },
          {
            providerId: "p-a",
            teamId: "t-2",
            eligible: true,
            ruleOutcomes: [],
            reasons: [],
            sortingFacts,
          },
          {
            providerId: "p-a",
            teamId: "t-1",
            eligible: true,
            ruleOutcomes: [],
            reasons: [],
            sortingFacts,
          },
        ],
      }),
    );
    expect(projection.candidates.map((c) => `${c.providerId}:${c.teamId}`)).toEqual([
      "p-a:t-1",
      "p-a:t-2",
      "p-b:t-2",
    ]);
  });
});

describe("Browse request validation (T042)", () => {
  it("rejects providerIds on the Browse facade", () => {
    expect(() =>
      validateBrowseCandidatesRequest({
        ...buildBrowseCandidatesRequest(),
        providerIds: [R1_P11_IDS.providerId],
      } as never),
    ).toThrow(EligibilityError);
    try {
      validateBrowseCandidatesRequest({
        ...buildBrowseCandidatesRequest(),
        providerIds: [R1_P11_IDS.providerId],
      } as never);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(EligibilityError);
      expect((error as EligibilityError).code).toBe("VALIDATION_FAILED");
      expect((error as EligibilityError).details?.["field"]).toBe("providerIds");
    }
  });

  it("accepts discovery-shaped Browse requests", () => {
    expect(() =>
      validateBrowseCandidatesRequest(buildBrowseCandidatesRequest()),
    ).not.toThrow();
  });

  it("does not treat eligibleForPublicBrowse as an exclusion filter", () => {
    const serviceSource = readFileSync(
      join(process.cwd(), "src/modules/eligibility/eligibility.service.ts"),
      "utf8",
    );
    expect(serviceSource).not.toMatch(/eligibleForPublicBrowse/u);
    const projection = mapDiagnosticToBrowseSafeProjection(buildDiagnostic());
    expect(projection.candidates).toHaveLength(1);
  });
});
