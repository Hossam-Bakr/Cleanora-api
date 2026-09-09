/**
 * R1-P11 Browse facade integration (Batch F / T041–T042).
 * Live composed proofs are DB-gated via CLEANORA_R1_P11_DATABASE_URL.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  createEligibilityApplicationService,
  mapDiagnosticToBrowseSafeProjection,
  validateBrowseCandidatesRequest,
} from "#modules/eligibility/eligibility.public";
import type { DiagnosticResult, SortingFacts } from "#modules/eligibility/eligibility.public";
import {
  buildBrowseCandidatesRequest,
  hasExplicitR1P11TestDatabase,
  R1_P11_IDS,
} from "../../helpers/r1-p11-eligibility-fixtures.js";
import { createR1P11EligibilityLiveHarness } from "../../helpers/r1-p11-eligibility-live.js";

const live = hasExplicitR1P11TestDatabase();

const sortingFacts: SortingFacts = {
  priceAmount: "10.00",
  minimumChargeAmount: "10.00",
  currencyCode: "EGP",
  priceUnitId: "u1",
  estimatedDurationMinutes: 60,
  matchingCapacityUnits: 1,
};

describe.skipIf(!live)("R1-P11 Browse facade live (Batch F)", () => {
  it("invokes the composed facade against real P09/P10-backed facts", async () => {
    const h = await createR1P11EligibilityLiveHarness();
    try {
      const projection = await h.eligibility.getStandardBrowseCandidates({
        mode: "discovery",
        ...h.requestBase,
      });

      expect(projection.candidates.some((row) => row.providerId === h.provider.id)).toBe(
        true,
      );
      const encoded = JSON.stringify(projection);
      expect(encoded).not.toMatch(/workerId/u);
      expect(encoded).not.toContain("PROVIDER_NOT_LIVE");
      expect(encoded).not.toContain("eligibleForPublicBrowse");
      expect(encoded).not.toContain("excludedProviders");
    } finally {
      await h.close();
    }
  });
});

describe("R1-P11 Browse facade contract (always on)", () => {
  it("exposes createEligibilityApplicationService for composition wiring", () => {
    expect(typeof createEligibilityApplicationService).toBe("function");
  });

  it("composition registers eligibilityApplicationService without HTTP routes", () => {
    const composition = readFileSync(
      join(process.cwd(), "src/composition.ts"),
      "utf8",
    );
    expect(composition).toMatch(/eligibilityApplicationService/u);
    expect(composition).toMatch(/createEligibilityApplicationService/u);
    expect(composition).not.toMatch(/createEligibilityRouter|eligibilityRouter/u);

    const routes = readFileSync(join(process.cwd(), "src/routes/index.ts"), "utf8");
    expect(routes).not.toMatch(/eligibility/iu);
  });

  it("rejects providerIds on Browse facade validation", () => {
    expect(() =>
      validateBrowseCandidatesRequest({
        ...buildBrowseCandidatesRequest(),
        providerIds: [R1_P11_IDS.providerId],
      } as never),
    ).toThrow(EligibilityError);
  });

  it("maps diagnostic success to BrowseSafeProjection without exclusions", () => {
    const diagnostic = {
      evaluationId: R1_P11_IDS.evaluationId,
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
          providerId: "excluded",
          eligible: false,
          ruleOutcomes: [],
          reasons: ["PROVIDER_NOT_LIVE"],
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
    expect(projection.candidates).toHaveLength(1);
    expect(JSON.stringify(projection)).not.toContain("PROVIDER_NOT_LIVE");
    expect(JSON.stringify(projection)).not.toContain("eligibleForPublicBrowse");
  });

  it("documents that eligibleForPublicBrowse is not an exclusion filter", () => {
    const service = readFileSync(
      join(process.cwd(), "src/modules/eligibility/eligibility.service.ts"),
      "utf8",
    );
    expect(service).not.toMatch(/eligibleForPublicBrowse/u);
  });
});
