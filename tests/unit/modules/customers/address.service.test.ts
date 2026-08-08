
import { AddressService } from "../../../../src/modules/customers/address.service.js";

const principal = {
  userId: "owner", sessionId: "session", accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: ["INDIVIDUAL"] as const, pendingCategories: [], status: "ACTIVE" as const,
  verificationOnly: false,
};

describe("US2 address service boundary", () => {
  it("lists only SELF addresses and does not append a business audit for the read", async () => {
    const append = vi.fn();
    const service = new AddressService(
      { run: async (work: (context: unknown) => Promise<unknown>) => work({ prisma: {}, generalAudit: { append }, privilegedAudit: {} }) } as never,
      { list: async () => [{ id: "address", countryCode: "EG", city: "Cairo", district: "Maadi", addressText: "12 Road", building: null, floor: null, notes: null, version: 1 }] } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: async () => ({ id: "denial", createdAt: new Date().toISOString() }) },
    );

    await expect(service.list(principal)).resolves.toHaveLength(1);
    expect(append).not.toHaveBeenCalled();
  });

  it("writes redacted non-transactional evidence for a wrong-owner denial", async () => {
    const denialAppend = vi.fn(async () => ({ id: "denial", createdAt: new Date().toISOString() }));
    const service = new AddressService(
      { run: async (work: (context: unknown) => Promise<unknown>) => work({ prisma: {}, generalAudit: { append: vi.fn() }, privilegedAudit: {} }) } as never,
      {
        find: async () => ({
          id: "other-address", userId: "other", countryCode: "EG", city: "Cairo",
          district: "Maadi", addressText: "private", building: null, floor: null, notes: null, version: 1,
        }),
      } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );

    await expect(service.get(principal, "other-address")).rejects.toMatchObject({
      code: "CUSTOMER_ADDRESS_NOT_FOUND",
    });
    expect(denialAppend).toHaveBeenCalledWith(expect.objectContaining({
      action: "customers.address.read", targetId: "owner", outcome: "OWNERSHIP_DENIED",
    }));
    expect(denialAppend.mock.calls).toHaveLength(1);
  });

  it("audits an ineligible address denial before any repository mutation", async () => {
    const denialAppend = vi.fn(async () => ({ id: "denial", createdAt: new Date().toISOString() }));
    const list = vi.fn();
    const service = new AddressService(
      { run: async (work: (context: unknown) => Promise<unknown>) => work({ prisma: {}, generalAudit: { append: vi.fn() }, privilegedAudit: {} }) } as never,
      { list } as never,
      { resolveActiveCountry: async () => ({ id: "country" }) },
      { append: denialAppend },
    );

    await expect(service.list({ ...principal, verifiedCategories: [], pendingCategories: ["INDIVIDUAL"] }))
      .rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });
    expect(list).not.toHaveBeenCalled();
    expect(denialAppend).toHaveBeenCalledWith(expect.objectContaining({
      action: "customers.address.list", outcome: "CATEGORY_NOT_VERIFIED",
    }));
  });
});
