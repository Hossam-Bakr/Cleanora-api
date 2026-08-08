
import { IdentityContactRead } from "../../../../src/modules/customers/infrastructure/identity-contact.read.js";

describe("US3 contact-state projection", () => {
  it("projects Authentication facts without mutating identity or auditing the read", async () => {
    const reader = new IdentityContactRead({
      readContactFacts: async () => ({
        phoneE164: "+201234567890",
        emailNormalized: "customer@example.test",
        phoneVerifiedAt: null,
        emailVerifiedAt: new Date(),
      }),
    });

    await expect(reader.read("customer")).resolves.toEqual({
      phone: { value: "+201234567890", verified: false },
      email: { value: "customer@example.test", verified: true },
    });
  });
});
