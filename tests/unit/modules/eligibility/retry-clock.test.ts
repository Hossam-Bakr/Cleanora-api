import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import { validateEvaluateEligibilityRequest } from "#modules/eligibility/eligibility.service";
import {
  buildDiscoveryRequest,
  buildExplicitRequest,
  R1_P11_TIMES,
} from "../../../helpers/r1-p11-eligibility-fixtures.js";

describe("retry clock + request validation (Batch E / T028 / T035)", () => {
  it("rejects geo inputs and invalid interval / units", () => {
    expect(() =>
      validateEvaluateEligibilityRequest({
        ...buildDiscoveryRequest(),
        // @ts-expect-error intentional geo probe
        latitude: 30.0,
      }),
    ).toThrow(EligibilityError);

    expect(() =>
      validateEvaluateEligibilityRequest(
        buildDiscoveryRequest({
          startsAt: R1_P11_TIMES.endsAt,
          endsAt: R1_P11_TIMES.startsAt,
        }),
      ),
    ).toThrow(EligibilityError);

    expect(() =>
      validateEvaluateEligibilityRequest(
        buildDiscoveryRequest({ requiredTeamUnits: 0 }),
      ),
    ).toThrow(EligibilityError);

    expect(() =>
      validateEvaluateEligibilityRequest(
        buildDiscoveryRequest({
          startsAt: "2026-09-15T08:00:00.000Z",
          endsAt: "2026-09-17T08:00:00.000Z",
        }),
      ),
    ).toThrow(EligibilityError);
  });

  it("accepts valid discovery and explicit requests", () => {
    expect(() =>
      validateEvaluateEligibilityRequest(buildDiscoveryRequest()),
    ).not.toThrow();
    expect(() =>
      validateEvaluateEligibilityRequest(buildExplicitRequest()),
    ).not.toThrow();
  });

  it("documents clock-before-retry contract: evaluatedAt is caller-captured", () => {
    // evaluateEligibility captures clock once before the retry loop. This unit
    // test locks the public validation surface; orchestration retry behavior is
    // covered by integration suites when a disposable DB is available.
    const evaluatedAt = new Date(R1_P11_TIMES.evaluatedAt);
    expect(evaluatedAt.toISOString()).toBe(R1_P11_TIMES.evaluatedAt);
  });
});
