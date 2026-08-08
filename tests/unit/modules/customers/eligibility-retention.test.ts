
import { authorizeSharedImageOrAddressSelf } from "../../../../src/modules/customers/domain/customer-self.policy.js";

const owner = {
  userId: "owner", sessionId: "session", accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: ["INDIVIDUAL"] as const, pendingCategories: [], status: "ACTIVE" as const,
  verificationOnly: false,
};

describe("US5 eligibility-loss retention boundary", () => {
  it("suspends address access when eligibility is lost and allows it again when restored", () => {
    expect(authorizeSharedImageOrAddressSelf({
      principal: { ...owner, verifiedCategories: [] },
      resourceOwnerUserId: owner.userId,
    })).toMatchObject({ allowed: false });
    expect(authorizeSharedImageOrAddressSelf({
      principal: owner,
      resourceOwnerUserId: owner.userId,
    })).toEqual({ allowed: true });
  });
});
