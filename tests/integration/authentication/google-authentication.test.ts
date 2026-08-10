import {
  startAuthenticationTestApp,
  uniqueIdentity,
} from "../../helpers/authentication/test-authentication-app.js";

const request = require("supertest") as typeof import("supertest");
const origin = "http://localhost:5173";
vi.setConfig({ testTimeout: 120_000 });

function stateFrom(response: import("supertest").Response): string {
  return new URL(
    response.body.data.authorizationUrl as string,
  ).searchParams.get("state")!;
}

describe("Google individual authentication", () => {
  it("creates a fully active Individual from a Google-verified email", async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity("google-email-only");
    const agent = request.agent(context.app);
    try {
      context.google.program({
        subject: `google-${identity.email}`,
        email: identity.email,
        emailVerified: true,
        displayName: "Cleanora Google User",
        avatarUrl: "https://lh3.googleusercontent.com/a/cleanora",
      });
      const start = await agent.get("/api/v1/auth/google").expect(200);
      const callback = await agent
        .get("/api/v1/auth/google/callback")
        .query({ state: stateFrom(start), code: "deterministic" })
        .expect(303);

      expect(callback.headers["location"]).toContain(
        "google=success&intent=sign-in&verification=complete",
      );
      expect(callback.headers["location"]).not.toMatch(
        /accessToken|refreshToken|code=/iu,
      );

      const refreshed = await agent
        .post("/api/v1/auth/refresh")
        .set("Origin", origin)
        .expect(200);
      expect(refreshed.body.data).toMatchObject({
        verificationOnly: false,
        user: {
          email: identity.email,
          emailVerified: true,
          phone: null,
          phoneVerified: false,
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
          pendingCategories: [],
        },
      });
      expect(context.email.all()).toHaveLength(0);
      const user = await context.prisma.user.findUniqueOrThrow({
        where: { emailNormalized: identity.email },
      });
      await expect(
        context.prisma.individualProfile.findUniqueOrThrow({
          where: { userId: user.id },
        }),
      ).resolves.toMatchObject({ fullName: "Cleanora Google User" });
      await agent
        .get("/api/v1/auth/me")
        .set(
          "Authorization",
          `Bearer ${refreshed.body.data.accessToken as string}`,
        )
        .expect(200);
    } finally {
      await context.stop();
    }
  });

  it("rejects a provider identity whose email is not verified", async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity("google-unverified");
    const agent = request.agent(context.app);
    try {
      context.google.program({
        subject: `google-${identity.email}`,
        email: identity.email,
        emailVerified: false,
      });
      const start = await agent.get("/api/v1/auth/google").expect(200);
      const callback = await agent
        .get("/api/v1/auth/google/callback")
        .query({ state: stateFrom(start), code: "deterministic" })
        .expect(303);
      expect(callback.headers["location"]).toContain(
        "google=error&intent=sign-in&reason=authentication-failed",
      );
      expect(
        await context.prisma.user.count({
          where: { emailNormalized: identity.email },
        }),
      ).toBe(0);
    } finally {
      await context.stop();
    }
  });

  it("rejects a new verified Google identity without a usable profile name", async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity("google-missing-name");
    const agent = request.agent(context.app);
    try {
      context.google.program({
        subject: `google-${identity.email}`,
        email: identity.email,
        emailVerified: true,
        displayName: "   ",
      });
      const start = await agent.get("/api/v1/auth/google").expect(200);
      const callback = await agent
        .get("/api/v1/auth/google/callback")
        .query({ state: stateFrom(start), code: "deterministic" })
        .expect(303);
      expect(callback.headers["location"]).toContain(
        "google=error&intent=sign-in&reason=authentication-failed",
      );
      expect(await context.prisma.user.count({
        where: { emailNormalized: identity.email },
      })).toBe(0);
      expect(await context.prisma.individualProfile.count({
        where: { fullName: "" },
      })).toBe(0);
    } finally {
      await context.stop();
    }
  });

  it("links and unlinks Google only from a verified Individual session", async () => {
    const context = await startAuthenticationTestApp();
    const identity = uniqueIdentity("google-link");
    const agent = request.agent(context.app);
    try {
      const signup = await agent
        .post("/api/v1/auth/signup")
        .send({
          accountCategory: "INDIVIDUAL",
          fullName: "Google Link Customer",
          phone: identity.phone,
          email: identity.email,
          password: identity.password,
        })
        .expect(202);
      await agent
        .post("/api/v1/auth/otp/verify")
        .send({
          challengeId: signup.body.data.challengeId,
          code: context.email.latest(identity.email)!.value,
        })
        .expect(200);
      const login = await agent
        .post("/api/v1/auth/login")
        .send({ phone: identity.phone, password: identity.password })
        .expect(200);

      context.google.program({
        subject: `linked-${identity.email}`,
        email: `provider-${identity.email}`,
        emailVerified: true,
      });
      const start = await agent
        .get("/api/v1/auth/google/link")
        .set(
          "Authorization",
          `Bearer ${login.body.data.accessToken as string}`,
        )
        .expect(200);
      const callback = await agent
        .get("/api/v1/auth/google/callback")
        .query({ state: stateFrom(start), code: "deterministic" })
        .expect(303);
      expect(callback.headers["location"]).toContain(
        "google=success&intent=link",
      );

      await agent
        .delete("/api/v1/auth/social/google")
        .set(
          "Authorization",
          `Bearer ${login.body.data.accessToken as string}`,
        )
        .expect(200);
    } finally {
      await context.stop();
    }
  });
});
