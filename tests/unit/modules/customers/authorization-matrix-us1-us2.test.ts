
import { AddressService } from "../../../../src/modules/customers/address.service.js";
import { authorizeSharedImageOrAddressSelf } from "../../../../src/modules/customers/domain/customer-self.policy.js";

const self = {
  userId: "owner", sessionId: "session", accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: ["INDIVIDUAL"] as const, pendingCategories: [], status: "ACTIVE" as const,
  verificationOnly: false,
};

describe("US1–US2 authorization matrix", () => {
  it("denies pending-only, inactive, and wrong-owner address callers without relying on roles", () => {
    expect(authorizeSharedImageOrAddressSelf({
      principal: { ...self, verifiedCategories: [], pendingCategories: ["INDIVIDUAL"] },
      resourceOwnerUserId: "owner",
    })).toMatchObject({ allowed: false, denialCode: "CATEGORY_NOT_VERIFIED" });
    expect(authorizeSharedImageOrAddressSelf({
      principal: { ...self, status: "BANNED" },
      resourceOwnerUserId: "owner",
    })).toMatchObject({ allowed: false, denialCode: "IDENTITY_NOT_ACTIVE" });
    expect(authorizeSharedImageOrAddressSelf({
      principal: self,
      resourceOwnerUserId: "other",
    })).toMatchObject({ allowed: false, denialCode: "OWNERSHIP_DENIED" });
  });

  it("emits redacted non-transactional audit evidence for denied address access", async () => {
    const denialAppend = vi.fn(async () => ({ id: "denial", createdAt: new Date().toISOString() }));
    const service = new AddressService(
      { run: async (work: (context: unknown) => Promise<unknown>) => work({ prisma: {}, generalAudit: { append: vi.fn() }, privilegedAudit: {} }) } as never,
      { find: async () => ({ id: "address", userId: "other", countryCode: "EG", city: "private", district: "private", addressText: "private", building: null, floor: null, notes: null, version: 1 }) } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );
    await expect(service.get(self, "address")).rejects.toMatchObject({ code: "CUSTOMER_ADDRESS_NOT_FOUND" });
    expect(denialAppend).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "owner", action: "customers.address.read", outcome: "OWNERSHIP_DENIED", targetId: "owner",
    }));
    expect(denialAppend.mock.calls).toHaveLength(1);
  });
});
