import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  enrollSchema,
  selfSignupCategorySchema,
  signupSchema,
} from "../../../../src/modules/authentication/auth.schema.js";
import {
  SELF_SIGNUP_CATEGORIES,
  assertSelfSignupCategory,
} from "../../../../src/modules/authentication/domain/auth.policy.js";

const validSignupBody = {
  accountCategory: "PROVIDER_OWNER" as const,
  phone: "+201012345678",
  email: "owner@example.test",
  password: "Cleanora!9",
};

describe("R1-P05 provider onboarding authentication policy", () => {
  it("rejects PROVIDER_OWNER from public self-signup category policy", () => {
    expect(SELF_SIGNUP_CATEGORIES).not.toContain("PROVIDER_OWNER");
    expect(() => assertSelfSignupCategory("PROVIDER_OWNER")).toThrow(
      expect.objectContaining({
        code: expect.stringMatching(
          /AUTH_ACCOUNT_CATEGORY_NOT_ALLOWED|CATEGORY_NOT_ALLOWED/u,
        ),
      }),
    );
  });

  it("rejects PROVIDER_OWNER at signup and enrollment Zod boundaries", () => {
    expect(selfSignupCategorySchema.safeParse("PROVIDER_OWNER").success).toBe(
      false,
    );
    expect(signupSchema.safeParse({ body: validSignupBody }).success).toBe(
      false,
    );
    expect(
      enrollSchema.safeParse({
        body: { accountCategory: "PROVIDER_OWNER" },
      }).success,
    ).toBe(false);
  });

  it("still allows customer self-signup categories", () => {
    for (const category of ["INDIVIDUAL", "COMPANY", "ENGINEER"] as const) {
      expect(SELF_SIGNUP_CATEGORIES).toContain(category);
      expect(() => assertSelfSignupCategory(category)).not.toThrow();
    }
  });

  it("exposes PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION on OtpPurpose", async () => {
    const policySource = await readFile(
      join(
        process.cwd(),
        "src/modules/authentication/domain/auth.policy.ts",
      ),
      "utf8",
    );
    expect(policySource).toMatch(
      /export type OtpPurpose\s*=[\s\S]*PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION/u,
    );
  });

  it("documents invitation OTP null-category shape in auth policy surface", async () => {
    const policySource = await readFile(
      join(
        process.cwd(),
        "src/modules/authentication/domain/auth.policy.ts",
      ),
      "utf8",
    );
    // Invitation verification binds email with null account category.
    expect(policySource).toMatch(
      /PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION[\s\S]{0,400}null|null[\s\S]{0,400}PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION/iu,
    );
  });
});
