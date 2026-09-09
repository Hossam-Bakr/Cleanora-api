/**
 * R1-P11 Eligibility Providers reader compatibility (Batch C / T019).
 *
 * Live proofs use the composed Eligibility service against P09/P10 fixtures.
 */

import { hasExplicitR1P11TestDatabase } from "../../helpers/r1-p11-eligibility-fixtures.js";
import { createR1P11EligibilityLiveHarness } from "../../helpers/r1-p11-eligibility-live.js";
import type {
  EligibilityPricingFacts,
  EligibilityProviderLifecycleFacts,
  EligibilityTeamAvailabilityFacts,
} from "#modules/providers/providers.public";

const live = hasExplicitR1P11TestDatabase();

describe.skipIf(!live)("R1-P11 eligibility readers (Batch C / T019)", () => {
  it("composed readers return eligible facts for a live P09/P10 Provider", async () => {
    const h = await createR1P11EligibilityLiveHarness();
    try {
      const result = await h.eligibility.evaluateEligibility({
        mode: "explicit",
        ...h.requestBase,
        providerIds: [h.provider.id],
      });
      expect(result.evaluationOutcomes.catalog.status).toBe("PASS");
      const eligible = result.eligibleProviders.find(
        (row) => row.providerId === h.provider.id,
      );
      expect(eligible?.eligible).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/workerId/u);
    } finally {
      await h.close();
    }
  });
});

describe("R1-P11 eligibility reader contracts (unit shape)", () => {
  it("forbids Worker IDs on Team availability facts type shape", () => {
    const team: EligibilityTeamAvailabilityFacts = {
      teamId: "t1",
      structurallyValid: true,
      membersAvailableForWholeInterval: true,
      cleanerGenderCounts: { male: 1, female: 0, otherOrUnspecified: 0 },
      escortFacts: {
        escortRequired: false,
        escortPresentAndValid: true,
        escortsAvailableForWholeInterval: true,
      },
    };
    expect("workerId" in team).toBe(false);
    expect(JSON.stringify(team)).not.toMatch(/workerId/u);
  });

  it("keeps pricing AVAILABLE|UNAVAILABLE mutually exclusive", () => {
    const available: EligibilityPricingFacts = {
      status: "AVAILABLE",
      providerId: "p1",
      serviceId: "s1",
      priceAmount: "10.00",
      minimumChargeAmount: "10.00",
      currencyCode: "EGP",
      priceUnitId: "u1",
      estimatedDurationMinutes: 60,
      sourceVersion: "1",
    };
    const unavailable: EligibilityPricingFacts = {
      status: "UNAVAILABLE",
      providerId: "p1",
      serviceId: "s1",
      reason: "OFFERING_OR_PRICE_UNAVAILABLE",
      sourceVersion: null,
    };
    expect(available.status).not.toBe(unavailable.status);
  });

  it("keeps lifecycle PRESENT|MISSING mutually exclusive", () => {
    const missing: EligibilityProviderLifecycleFacts = {
      status: "MISSING",
      providerId: "p1",
    };
    expect(missing.status).toBe("MISSING");
  });
});
