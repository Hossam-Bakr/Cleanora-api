import {
  computeEvidenceHash,
  computeRequestHash,
  computeResultHash,
  eligibilityCanonicalJson,
  normalizeEligibilityRequest,
} from "#modules/eligibility/eligibility.hashes";
import {
  buildDiscoveryRequest,
  buildExplicitRequest,
  R1_P11_IDS,
  R1_P11_TIMES,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";

describe("eligibility determinism (Batch E / T033)", () => {
  it("normalizes omitted district to null and sorts explicit providerIds", () => {
    const discovery = normalizeEligibilityRequest(buildDiscoveryRequest());
    expect(discovery.districtId).toBe(R1_P11_IDS.districtId);
    const withoutDistrict = normalizeEligibilityRequest({
      mode: "discovery",
      serviceId: R1_P11_IDS.serviceId,
      countryId: R1_P11_IDS.countryId,
      cityId: R1_P11_IDS.cityId,
      startsAt: R1_P11_TIMES.startsAt,
      endsAt: R1_P11_TIMES.endsAt,
      crewPreference: "any",
      requiredTeamUnits: 1,
    });
    expect(withoutDistrict.districtId).toBeNull();
    expect(withoutDistrict.providerIds).toBeNull();

    const explicit = normalizeEligibilityRequest(
      buildExplicitRequest({
        providerIds: [R1_P11_IDS.otherProviderId, R1_P11_IDS.providerId],
      }),
    );
    expect(explicit.providerIds).toEqual([
      R1_P11_IDS.otherProviderId,
      R1_P11_IDS.providerId,
    ].sort((a, b) => a.localeCompare(b)));
  });

  it("hashes are stable for identical canonical inputs", () => {
    const normalized = normalizeEligibilityRequest(buildDiscoveryRequest());
    expect(computeRequestHash(normalized)).toBe(computeRequestHash(normalized));
    expect(eligibilityCanonicalJson({ b: 1, a: 2 })).toBe(
      eligibilityCanonicalJson({ a: 2, b: 1 }),
    );

    const evidence = {
      normalizedRequest: normalized,
      evaluatedAt: R1_P11_TIMES.evaluatedAt,
      pinnedRule: {
        ruleVersionId: R1_P11_IDS.ruleVersionId,
        contentChecksum: "abc",
        schemaVersion: "eligibility.rules.v1",
        engineCompatibility: "eligibility-engine.r1.v1",
        versionLabel: "r1-v1",
      },
      countryLocality: {
        countryCode: "EG",
        countryTimeZone: "Africa/Cairo",
        cityId: R1_P11_IDS.cityId,
        districtId: null,
        ancestryVersion: null,
      },
      evaluationOutcomes: {
        catalog: {
          ruleId: "CATALOG_APPLICABILITY" as const,
          status: "PASS" as const,
          reasons: [],
        },
      },
      providers: [],
      engineCalendar: {
        engineVersion: "eligibility-engine.r1.v1",
        calendarRuntimeVersion: "providers-availability-calendar.r1.v1",
        contractVersion: "eligibility.public.v1",
      },
      sourceVersions: {},
    };
    expect(computeEvidenceHash(evidence)).toBe(computeEvidenceHash(evidence));

    const semantic = {
      evaluationOutcomes: evidence.evaluationOutcomes,
      eligibleProviders: [],
      eligibleTeams: [],
      excludedProviders: [],
      excludedTeams: [],
      metadata: {
        contractVersion: "eligibility.public.v1",
        engineVersion: "eligibility-engine.r1.v1",
        ruleVersionId: R1_P11_IDS.ruleVersionId,
        ruleChecksum: "abc",
        requestHash: computeRequestHash(normalized),
        evidenceHash: computeEvidenceHash(evidence),
        resultHash: "placeholder",
        evaluatedAt: R1_P11_TIMES.evaluatedAt,
        countryTimeZone: "Africa/Cairo",
        calendarRuntimeVersion: "providers-availability-calendar.r1.v1",
        sourceVersions: {},
        discovery: {
          mode: "discovery" as const,
          countryId: R1_P11_IDS.countryId,
          cityId: R1_P11_IDS.cityId,
          districtId: null,
          discoveredProviderCount: 0,
          evaluatedProviderCount: 0,
          teamResultCount: 0,
          complete: true,
        },
        limits: { maxProviders: 500 as const, maxTeamResults: 5000 as const },
      },
    };
    const hashA = computeResultHash(semantic);
    const hashB = computeResultHash(semantic);
    expect(hashA).toBe(hashB);
  });
});
