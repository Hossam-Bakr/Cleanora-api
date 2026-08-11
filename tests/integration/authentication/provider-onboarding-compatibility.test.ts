import {
  AUTHORIZATION_PERMISSIONS,
  ROLE_PERMISSION_MAP,
} from "../../../src/modules/authentication/domain/authorization.catalog.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { signupSchema } from "../../../src/modules/authentication/auth.schema.js";
import {
  INVITATION_ONBOARDING_ALLOWED_ACTIONS,
  resolveAuthenticatedCapability,
} from "../../../src/modules/authentication/domain/auth.policy.js";
import type { IdentityState } from "../../../src/modules/authentication/domain/authentication.types.js";

const requiredStaffProviderPermissions = [
  "providers.applications.review",
  "providers.lifecycle.manage",
] as const;

const categorylessInvitee: IdentityState = {
  id: "invitee",
  phoneE164: "+201111111111",
  emailNormalized: "invitee@example.com",
  status: "ACTIVE",
  accountCategories: [],
  verifiedCategories: [],
  emailVerifiedAt: new Date("2026-08-11T10:00:00.000Z"),
  phoneVerifiedAt: null,
  suspendedUntil: null,
};

describe("R1-P05 provider onboarding authentication compatibility", () => {
  it("includes Staff Provider review and lifecycle permissions in the catalog", () => {
    const codes = AUTHORIZATION_PERMISSIONS.map((permission) => permission.code);
    expect(codes).toEqual(
      expect.arrayContaining([...requiredStaffProviderPermissions]),
    );
  });

  it("grants both Staff Provider permissions only to staff_admin", () => {
    const staffAdmin = ROLE_PERMISSION_MAP["staff_admin"] ?? [];
    expect(staffAdmin).toEqual(
      expect.arrayContaining([...requiredStaffProviderPermissions]),
    );

    for (const [roleCode, permissionCodes] of Object.entries(
      ROLE_PERMISSION_MAP,
    )) {
      if (roleCode === "staff_admin") {
        continue;
      }
      for (const permission of requiredStaffProviderPermissions) {
        expect(permissionCodes).not.toContain(permission);
      }
    }
  });

  it("rejects public PROVIDER_OWNER enrollment while invitation OTP creates a restricted principal", () => {
    expect(
      signupSchema.safeParse({
        body: {
          accountCategory: "PROVIDER_OWNER",
          phone: "+201111111111",
          email: "owner@example.com",
          password: "Strong-pass-123",
        },
      }).success,
    ).toBe(false);
    expect(resolveAuthenticatedCapability(categorylessInvitee)).toBe(
      "PROVIDER_ADMIN_INVITATION_ONBOARDING",
    );
    expect(INVITATION_ONBOARDING_ALLOWED_ACTIONS).toEqual([
      "ACCEPT_PROVIDER_ADMIN_INVITATION",
      "SESSION_CLEANUP",
    ]);
  });

  it("grants full login from enabled provider_admin without reading Provider tables", async () => {
    expect(
      resolveAuthenticatedCapability(categorylessInvitee, {
        providerAdminEnabled: true,
      }),
    ).toBe("FULL");
    const source = await readFile(
      join(process.cwd(), "src/modules/authentication/domain/auth.policy.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/modules\/providers|providerRepository|ProviderRepository/u);
  });
});
