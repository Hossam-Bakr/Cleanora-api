import {
  changeSchema,
  enrollSchema,
  forgotSchema,
  loginSchema,
  otpVerifySchema,
  resetSchema,
  signupSchema,
} from "../../../../src/modules/authentication/http/authentication.schemas.js";

describe("authentication HTTP schemas", () => {
  it("requires email for non-individual signup while accepting optional individual email", () => {
    expect(
      signupSchema.safeParse({
        body: {
          accountCategory: "COMPANY",
          phone: "+201012345678",
          password: "safe-pass",
        },
      }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({
        body: {
          accountCategory: "COMPANY",
          phone: "+201012345678",
          email: "company@example.test",
          password: "safe-pass",
        },
      }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({
        body: {
          accountCategory: "INDIVIDUAL",
          phone: "+201012345678",
          password: "safe-pass",
        },
      }).success,
    ).toBe(true);
  });

  it("aggregates simultaneous phone and password policy failures", () => {
    const result = signupSchema.safeParse({
      body: {
        accountCategory: "INDIVIDUAL",
        phone: "not-a-phone",
        password: "1234567",
      },
    });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["body.phone", "body.password"]));
  });

  it("rejects worker enrollment and accepts supported category enrollment", () => {
    expect(
      enrollSchema.safeParse({ body: { accountCategory: "WORKER" } }).success,
    ).toBe(false);
    expect(
      enrollSchema.safeParse({ body: { accountCategory: "ENGINEER" } }).success,
    ).toBe(true);
  });

  it("enforces six-digit OTP codes and login phone shape", () => {
    expect(
      otpVerifySchema.safeParse({
        body: { challengeId: "challenge-1", code: "12a456" },
      }).success,
    ).toBe(false);
    expect(
      otpVerifySchema.safeParse({
        body: { challengeId: "challenge-1", code: "123456" },
      }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({
        body: { phone: "01012345678", password: "x" },
      }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        body: { phone: "+201012345678", password: "x" },
      }).success,
    ).toBe(true);
  });

  it("applies the same password policy to reset and change payloads", () => {
    expect(
      resetSchema.safeParse({
        body: {
          challengeId: "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
          code: "5486",
          newPassword: "password",
        },
      }).success,
    ).toBe(false);
    expect(
      resetSchema.safeParse({
        body: {
          challengeId: "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
          code: "548",
          newPassword: "8392741",
        },
      }).success,
    ).toBe(false);
    expect(
      resetSchema.safeParse({
        body: {
          challengeId: "0d301aa0-a709-48e5-a5a6-1e5bfb7f132c",
          code: "5486",
          newPassword: "8392741",
        },
      }).success,
    ).toBe(true);
    expect(
      changeSchema.safeParse({
        body: { currentPassword: "old-pass", newPassword: "12121212" },
      }).success,
    ).toBe(false);
    expect(
      forgotSchema.safeParse({
        body: { accountCategory: "INDIVIDUAL", identifier: "+201012345678" },
      }).success,
    ).toBe(true);
  });
});
