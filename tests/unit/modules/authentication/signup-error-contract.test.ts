import { AuthenticationService } from "../../../../src/modules/authentication/auth.service.js";
import { authenticationError } from "../../../../src/modules/authentication/domain/authentication.errors.js";

function createService(): AuthenticationService {
  return new AuthenticationService({
    passwordHasher: {
      hash: async () => "hash",
      verify: async () => true,
      dummyVerify: async () => undefined,
    },
    tokens: {
      issueAccess: () => ({ token: "access", expiresAt: new Date() }),
      issueRefresh: (_claims, expiresAt) => ({
        token: "refresh",
        expiresAt,
      }),
      verifyAccess: () => ({
        userId: "user-1",
        sessionId: "session-1",
        credentialVersion: 1,
      }),
      verifyRefresh: () => ({
        userId: "user-1",
        sessionId: "session-1",
        credentialVersion: 1,
        rotationCounter: 0,
        jwtId: "jwt-1",
      }),
    },
    verifier: {
      randomOtp: () => "123456",
      randomSecret: () => "secret",
      verifyOtp: () => "otp-verifier",
      verifyReset: () => "reset-verifier",
      verifyRefresh: () => "refresh-verifier",
      hashDestination: () => "a".repeat(64),
      equals: (left, right) => left === right,
    },
    email: { send: async () => undefined },
    accessTtlSeconds: 900,
    refreshTtlSeconds: 3600,
    privacyHashSecret: "privacy-test-secret",
  });
}

describe("descriptive signup errors", () => {
  it("identifies a phone already assigned to another account", async () => {
    const service = createService();
    Object.defineProperty(service, "users", {
      value: {
        findByPhone: vi.fn(async () => ({ id: "existing-user" })),
        findByEmail: vi.fn(async () => null),
      },
    });

    await expect(
      service.signup({
        accountCategory: "INDIVIDUAL",
        phone: "+201012345678",
        password: "8392741",
      }),
    ).rejects.toMatchObject({
      code: "AUTH_PHONE_ALREADY_REGISTERED",
      statusCode: 409,
      message: expect.stringContaining("phone number is already registered"),
      details: { field: "phone", reason: "already_registered" },
    });
  });

  it("identifies an email already assigned to another account", async () => {
    const service = createService();
    Object.defineProperty(service, "users", {
      value: {
        findByPhone: vi.fn(async () => null),
        findByEmail: vi.fn(async () => ({ id: "existing-user" })),
      },
    });

    await expect(
      service.signup({
        accountCategory: "COMPANY",
        phone: "+201012345678",
        email: "owner@example.com",
        password: "8392741",
      }),
    ).rejects.toMatchObject({
      code: "AUTH_EMAIL_ALREADY_REGISTERED",
      statusCode: 409,
      message: expect.stringContaining("email address is already registered"),
      details: { field: "email", reason: "already_registered" },
    });
  });

  it("returns phone and email conflicts together when both are registered", async () => {
    const service = createService();
    Object.defineProperty(service, "users", {
      value: {
        findByPhone: vi.fn(async () => ({ id: "phone-owner" })),
        findByEmail: vi.fn(async () => ({ id: "email-owner" })),
      },
    });

    await expect(
      service.signup({
        accountCategory: "INDIVIDUAL",
        phone: "+201012345678",
        email: "owner@example.com",
        password: "8392741",
      }),
    ).rejects.toMatchObject({
      code: "AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED",
      statusCode: 409,
      details: {
        issues: [
          {
            path: "phone",
            code: "already_registered",
            message: "This phone number is already registered.",
          },
          {
            path: "email",
            code: "already_registered",
            message: "This email address is already registered.",
          },
        ],
      },
    });
  });

  it("keeps login failure generic while returning an actionable message", () => {
    const error = authenticationError("AUTHENTICATION_FAILED");

    expect(error).toMatchObject({
      code: "AUTHENTICATION_FAILED",
      statusCode: 401,
      message: "The phone number or password is incorrect.",
    });
    expect(error.message).not.toContain("registered");
  });

  it("rejects Google sign-in without a provider-verified email", async () => {
    const service = createService();
    await expect(
      service.googleSignIn({
        subject: "google-subject",
        emailVerified: false,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_AUTHENTICATION_FAILED" });
    await expect(
      service.googleSignIn({
        subject: "google-subject",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_AUTHENTICATION_FAILED" });
  });

  it("rejects Google sign-in when the provider email already belongs to another identity", async () => {
    const service = createService();
    Object.defineProperty(service, "social", {
      value: { findGoogle: vi.fn(async () => null) },
    });
    Object.defineProperty(service, "users", {
      value: {
        findByEmail: vi.fn(async () => ({ id: "existing" })),
        findById: vi.fn(),
        map: vi.fn(),
      },
    });

    await expect(
      service.googleSignIn({
        subject: "google-subject",
        email: "owner@example.com",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_AUTHENTICATION_FAILED" });
  });

  it("rejects Google sign-in for a linked non-Individual account category", async () => {
    const service = createService();
    Object.defineProperty(service, "social", {
      value: {
        findGoogle: vi.fn(async () => ({ userId: "user-1" })),
        updateGoogleProfile: vi.fn(async () => undefined),
      },
    });
    Object.defineProperty(service, "users", {
      value: {
        findById: vi.fn(async () => ({
          id: "user-1",
          accountCategories: ["COMPANY"],
          verifiedCategories: ["COMPANY"],
        })),
        findByEmail: vi.fn(),
        map: vi.fn(),
      },
    });

    await expect(
      service.googleSignIn({
        subject: "google-subject",
        email: "owner@example.com",
        emailVerified: true,
        displayName: "Owner",
        avatarUrl: "https://lh3.googleusercontent.com/a/avatar",
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_AUTHENTICATION_FAILED" });
  });

  it("rejects Google link and unlink when DEC-028 safety gates fail", async () => {
    const service = createService();
    const principal = {
      userId: "user-1",
      sessionId: "session-1",
      accountCategories: ["INDIVIDUAL"] as const,
      verifiedCategories: ["INDIVIDUAL"] as const,
      pendingCategories: [],
      status: "ACTIVE" as const,
      verificationOnly: false,
    };

    await expect(
      service.linkGoogle(
        { ...principal, verificationOnly: true },
        { subject: "g", email: "a@example.com", emailVerified: true },
      ),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_LINK_FAILED" });
    await expect(
      service.linkGoogle(principal, {
        subject: "g",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_LINK_FAILED" });
    await expect(
      service.linkGoogle(principal, {
        subject: "g",
        email: "a@example.com",
        emailVerified: false,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_LINK_FAILED" });

    Object.defineProperty(service, "social", {
      value: { findGoogle: vi.fn(async () => ({ userId: "other" })) },
    });
    await expect(
      service.linkGoogle(principal, {
        subject: "g",
        email: "a@example.com",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_LINK_FAILED" });

    Object.defineProperty(service, "credentials", {
      value: { findByUserId: vi.fn(async () => null) },
    });
    await expect(service.unlinkGoogle(principal)).rejects.toMatchObject({
      code: "AUTH_SOCIAL_UNLINK_UNSAFE",
    });
  });

  it("rejects Google sign-in when identity creation or activation fails closed", async () => {
    const service = createService();
    Object.defineProperty(service, "social", {
      value: { findGoogle: vi.fn(async () => null) },
    });
    Object.defineProperty(service, "users", {
      value: {
        findByEmail: vi.fn(async () => null),
        findById: vi.fn(),
        map: vi.fn(),
      },
    });
    Object.defineProperty(service, "transactions", {
      value: {
        createGoogleIdentity: vi.fn(async () => null),
        activateGoogleIndividual: vi.fn(),
      },
    });

    await expect(
      service.googleSignIn({
        subject: "google-subject",
        email: "new@example.com",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_AUTHENTICATION_FAILED" });

    Object.defineProperty(service, "social", {
      value: {
        findGoogle: vi.fn(async () => ({ userId: "user-1" })),
        updateGoogleProfile: vi.fn(async () => undefined),
      },
    });
    Object.defineProperty(service, "users", {
      value: {
        findById: vi.fn(async () => ({
          id: "user-1",
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: [],
        })),
        findByEmail: vi.fn(),
        map: vi.fn(),
      },
    });
    Object.defineProperty(service, "transactions", {
      value: {
        createGoogleIdentity: vi.fn(),
        activateGoogleIndividual: vi.fn(async () => null),
      },
    });

    await expect(
      service.googleSignIn({
        subject: "google-subject",
        email: "new@example.com",
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_AUTHENTICATION_FAILED" });
  });

  it("rejects Google link principal when credential versions diverge", async () => {
    const service = createService();
    Object.defineProperty(service, "users", {
      value: {
        findById: vi.fn(async () => ({
          id: "user-1",
          phoneE164: "+201000000000",
          emailNormalized: "a@example.com",
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
          status: "ACTIVE",
          suspendedUntil: null,
          phoneVerifiedAt: null,
          emailVerifiedAt: new Date(),
        })),
        map: (user: unknown) => user,
      },
    });
    Object.defineProperty(service, "sessions", {
      value: {
        find: vi.fn(async () => ({
          id: "session-1",
          userId: "user-1",
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          capability: "FULL",
          credentialVersion: 1,
        })),
      },
    });
    Object.defineProperty(service, "credentials", {
      value: { findByUserId: vi.fn(async () => ({ credentialVersion: 2 })) },
    });

    await expect(
      service.resolveGoogleLinkPrincipal("user-1", "session-1"),
    ).rejects.toMatchObject({ code: "AUTH_SOCIAL_LINK_FAILED" });
  });
});
