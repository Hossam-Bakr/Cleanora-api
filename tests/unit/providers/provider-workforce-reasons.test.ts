
import {
  PROVIDER_ADMIN_GRANT_REASONS,
  PROVIDER_ADMIN_REVOCATION_REASONS,
  validateReason,
  WORKER_ACCESS_REVOCATION_REASONS,
  WORKER_DEACTIVATION_REASONS,
  WORKER_REMOVAL_REASONS,
} from "../../../src/modules/providers/domain/provider-workforce.policy.js";

describe("closed action-specific workforce reason catalogs", () => {
  it("contains exactly the five approved catalogs", () => {
    expect(WORKER_DEACTIVATION_REASONS).toEqual([
      "TEMPORARILY_UNAVAILABLE", "SCHEDULE_OR_LEAVE", "PERFORMANCE_OR_POLICY",
      "PROVIDER_OPERATIONAL_CHANGE", "OTHER",
    ]);
    expect(WORKER_REMOVAL_REASONS).toEqual([
      "ENGAGEMENT_ENDED", "PERFORMANCE_OR_POLICY", "DUPLICATE_OR_INCORRECT_RECORD", "OTHER",
    ]);
    expect(WORKER_ACCESS_REVOCATION_REASONS).toEqual([
      "SECURITY_CONCERN", "ACCESS_NO_LONGER_REQUIRED", "ENGAGEMENT_ENDED", "OTHER",
    ]);
    expect(PROVIDER_ADMIN_GRANT_REASONS).toEqual([
      "OPERATIONAL_RESPONSIBILITY", "COVERAGE_OR_BACKUP", "OTHER",
    ]);
    expect(PROVIDER_ADMIN_REVOCATION_REASONS).toEqual([
      "RESPONSIBILITY_ENDED", "SECURITY_CONCERN", "ENGAGEMENT_ENDED", "OTHER",
    ]);
  });

  it("rejects codes borrowed from another action and requires notes only where approved", () => {
    expect(() => validateReason("WORKER_DEACTIVATE", "SECURITY_CONCERN"))
      .toThrowError(expect.objectContaining({ code: "WORKFORCE_REASON_INVALID" }));
    expect(() => validateReason("ACCESS_REVOKE", "TEMPORARILY_UNAVAILABLE"))
      .toThrowError(expect.objectContaining({ code: "WORKFORCE_REASON_INVALID" }));
    expect(() => validateReason("WORKER_REMOVE", "ENGAGEMENT_ENDED"))
      .toThrowError(expect.objectContaining({ code: "WORKFORCE_REASON_NOTE_REQUIRED" }));
    expect(() => validateReason("ADMIN_GRANT", "OTHER", "too short"))
      .toThrowError(expect.objectContaining({ code: "WORKFORCE_REASON_NOTE_REQUIRED" }));
    expect(() => validateReason("ACCESS_REVOKE", "SECURITY_CONCERN")).not.toThrow();
    expect(() => validateReason("ADMIN_REVOKE", "OTHER", "Meaningful owner note")).not.toThrow();
  });
});
