import { CustomerOverviewService } from "../../../../src/modules/customers/customer-overview.service.js";

const principal = {
  userId: "user-1",
  sessionId: "session-1",
  accountCategories: ["PROVIDER_OWNER", "COMPANY", "INDIVIDUAL", "ENGINEER"],
  verifiedCategories: ["COMPANY", "INDIVIDUAL"],
  pendingCategories: ["ENGINEER"],
  status: "ACTIVE",
  verificationOnly: false,
} as const;

describe("CustomerOverviewService", () => {
  it("returns the complete frontend projection for every verified customer category", async () => {
    const profileGet = vi.fn(async ({ category }: { category: string }) => ({
      category,
      created: true,
      ...(category === "COMPANY"
        ? { companyName: "Cleanora Services", representativeFullName: "Aly" }
        : { fullName: "Aly" }),
    }));
    const imageGet = vi.fn(async () => ({
      mediaId: "media-1",
      url: "https://example.test/signed-profile.webp",
      urlExpiresAt: "2026-08-09T12:15:00.000Z",
      associationVersion: 2,
      contentType: "image/webp",
      width: 1200,
      height: 900,
    }));
    const addressList = vi.fn(async () => [
      {
        id: "address-1",
        countryCode: "EG",
        city: "Cairo",
        district: "Nasr City",
        addressText: "Example Street",
        building: null,
        floor: null,
        notes: null,
        version: 1,
      },
    ]);
    const contactState = vi.fn(async () => ({
      phone: { value: "+201001234567", verified: false },
      email: { value: "user@example.test", verified: true },
    }));
    const preferencesGet = vi.fn(async () => ({
      version: 1,
      language: "EN" as const,
      reminders: { sms: false, push: false },
      promotional: { sms: false, push: false },
      mandatory: {
        security: { sms: true as const, push: true as const },
        activeService: { sms: true as const, push: true as const },
      },
    }));
    const denialAppend = vi.fn();
    const service = new CustomerOverviewService(
      { get: profileGet } as never,
      { get: imageGet } as never,
      { list: addressList } as never,
      { get: preferencesGet, contactState } as never,
      { append: denialAppend } as never,
    );

    const result = await service.get(principal, "request-1");

    expect(result.identity).toEqual({
      userId: "user-1",
      status: "ACTIVE",
      accountCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
      verifiedCategories: ["INDIVIDUAL", "COMPANY"],
      pendingCategories: ["ENGINEER"],
    });
    expect(result.profiles.map((profile) => profile.category)).toEqual([
      "INDIVIDUAL",
      "COMPANY",
    ]);
    expect(result.profileImage?.mediaId).toBe("media-1");
    expect(result.contactState.email.verified).toBe(true);
    expect(result.preferences.language).toBe("EN");
    expect(result.addresses).toHaveLength(1);
    expect(profileGet).toHaveBeenCalledTimes(2);
    expect(imageGet).toHaveBeenCalledOnce();
    expect(addressList).toHaveBeenCalledOnce();
    expect(contactState).toHaveBeenCalledOnce();
    expect(preferencesGet).toHaveBeenCalledOnce();
    expect(denialAppend).not.toHaveBeenCalled();
  });

  it("denies the aggregate once before reading any protected component", async () => {
    const profileGet = vi.fn();
    const imageGet = vi.fn();
    const addressList = vi.fn();
    const contactState = vi.fn();
    const preferencesGet = vi.fn();
    const denialAppend = vi.fn(async () => ({
      id: "audit-1",
      createdAt: new Date().toISOString(),
    }));
    const service = new CustomerOverviewService(
      { get: profileGet } as never,
      { get: imageGet } as never,
      { list: addressList } as never,
      { get: preferencesGet, contactState } as never,
      { append: denialAppend } as never,
    );

    await expect(
      service.get({ ...principal, status: "SUSPENDED" }, "request-2"),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });
    expect(denialAppend).toHaveBeenCalledOnce();
    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.overview.read",
        outcome: "IDENTITY_NOT_ACTIVE",
        requestId: "request-2",
      }),
    );
    expect(profileGet).not.toHaveBeenCalled();
    expect(imageGet).not.toHaveBeenCalled();
    expect(addressList).not.toHaveBeenCalled();
    expect(contactState).not.toHaveBeenCalled();
    expect(preferencesGet).not.toHaveBeenCalled();
  });

  it("bounds protected reads instead of opening every transaction at once", async () => {
    let active = 0;
    let maxActive = 0;
    const tracked = async <T>(value: T): Promise<T> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return value;
    };
    const service = new CustomerOverviewService(
      {
        get: async ({
          category,
        }: {
          category: "INDIVIDUAL" | "COMPANY" | "ENGINEER";
        }) =>
          tracked({ category, created: false }),
      } as never,
      { get: async () => tracked(null) } as never,
      { list: async () => tracked([]) } as never,
      {
        contactState: async () =>
          tracked({
            phone: { value: null, verified: false },
            email: { value: "user@example.test", verified: true },
          }),
        get: async () =>
          tracked({
            version: 1,
            language: null,
            reminders: { sms: false, push: false },
            promotional: { sms: false, push: false },
            mandatory: {
              security: { sms: true, push: true },
              activeService: { sms: true, push: true },
            },
          }),
      } as never,
      { append: vi.fn() } as never,
    );

    await service.get(principal);

    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
