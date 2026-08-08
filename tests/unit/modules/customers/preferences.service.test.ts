
import { IdentityContactRead } from "../../../../src/modules/customers/infrastructure/identity-contact.read.js";
import { PreferencesService } from "../../../../src/modules/customers/preferences.service.js";

const principal = {
  userId: "owner", sessionId: "session", accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: ["INDIVIDUAL"] as const, pendingCategories: [], status: "ACTIVE" as const,
  verificationOnly: false,
};

describe("US3 preference service boundary", () => {
  it("returns first-use defaults without appending a business audit for the read", async () => {
    const append = vi.fn();
    const service = new PreferencesService(
      { run: async (work: (context: unknown) => Promise<unknown>) => work({ prisma: {}, generalAudit: { append }, privilegedAudit: {} }) } as never,
      { get: async () => undefined } as never,
      new IdentityContactRead({
        readContactFacts: async () => ({
          phoneE164: null, emailNormalized: null, phoneVerifiedAt: null, emailVerifiedAt: null,
        }),
      }),
      { append: async () => ({ id: "denial", createdAt: new Date().toISOString() }) },
    );

    await expect(service.get(principal)).resolves.toMatchObject({
      version: 1, language: null,
      reminders: { sms: false, push: false },
      promotional: { sms: false, push: false },
    });
    expect(append).not.toHaveBeenCalled();
  });
});
