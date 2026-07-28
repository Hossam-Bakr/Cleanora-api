import {
  startAuthenticationTestApp,
  uniqueIdentity,
} from "../../helpers/authentication/test-authentication-app.js";

const request = require("supertest") as typeof import("supertest");
vi.setConfig({ testTimeout: 90_000 });

describe("individual email verification", () => {
  it("requires email and activates the category without verifying the phone", async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity("individual-email");
    try {
      await request(context.app)
        .post("/api/v1/auth/signup")
        .send({
          accountCategory: "INDIVIDUAL",
          phone: identity.phone,
          password: identity.password,
        })
        .expect(400);

      const signup = await request(context.app)
        .post("/api/v1/auth/signup")
        .send({
          accountCategory: "INDIVIDUAL",
          phone: identity.phone,
          email: identity.email,
          password: identity.password,
        })
        .expect(202);
      expect(signup.body.data.channel).toBe("EMAIL");

      const delivery = context.email.latest(identity.email);
      expect(delivery).toBeDefined();
      await request(context.app)
        .post("/api/v1/auth/otp/verify")
        .send({
          challengeId: signup.body.data.challengeId,
          code: delivery!.value,
        })
        .expect(200);

      const user = await context.prisma.user.findUniqueOrThrow({
        where: { emailNormalized: identity.email },
      });
      expect(user.verifiedCategories).toEqual(["INDIVIDUAL"]);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
      expect(user.phoneVerifiedAt).toBeNull();
    } finally {
      await context.stop();
    }
  });
});
