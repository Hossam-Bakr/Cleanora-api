import { AuthenticationService } from "../../../../src/modules/authentication/application/authentication.service.js";
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
    sms: { send: async () => undefined },
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
});
