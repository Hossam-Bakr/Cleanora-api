
import { authorizeContactPrefsPrivacySelf } from "../../../../src/modules/customers/domain/customer-self.policy.js";

const principal = {
  userId: "customer", sessionId: "session", accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: [] as const, pendingCategories: ["INDIVIDUAL"] as const,
  status: "ACTIVE" as const, verificationOnly: false,
};

describe("US3–US4 customer authorization matrix", () => {
  it("keeps pending-only customer self access for contact, preferences, and privacy requests", () => {
    expect(authorizeContactPrefsPrivacySelf({
      principal, resourceOwnerUserId: "customer",
    })).toEqual({ allowed: true });
  });

  it("denies a forged cross-customer owner relationship", () => {
    expect(authorizeContactPrefsPrivacySelf({
      principal, resourceOwnerUserId: "other-customer",
    })).toEqual({ allowed: false, denialCode: "OWNERSHIP_DENIED" });
  });
});
