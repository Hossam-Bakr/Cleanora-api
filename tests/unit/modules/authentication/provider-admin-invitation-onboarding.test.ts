import {
  INVITATION_ONBOARDING_ALLOWED_ACTIONS,
  invitationOnboardingCapability,
  loginCapability,
  resolveAuthenticatedCapability,
} from "../../../../src/modules/authentication/domain/auth.policy.js";
import type { IdentityState } from "../../../../src/modules/authentication/domain/authentication.types.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function categorylessIdentity(
  overrides: Partial<IdentityState> = {},
): IdentityState {
  return {
    id: "user-invitee",
    phoneE164: "+201234567890",
    emailNormalized: "invitee@example.com",
    status: "ACTIVE",
    accountCategories: [],
    verifiedCategories: [],
    emailVerifiedAt: new Date("2026-08-10T12:00:00.000Z"),
    phoneVerifiedAt: null,
    suspendedUntil: null,
    ...overrides,
  };
}

describe("provider admin invitation onboarding policy (T118)", () => {
  it("keeps invitation onboarding restricted to accept and session cleanup", () => {
    const capability = invitationOnboardingCapability(categorylessIdentity());
    expect(capability).toBe("PROVIDER_ADMIN_INVITATION_ONBOARDING");
    expect(INVITATION_ONBOARDING_ALLOWED_ACTIONS).toEqual([
      "ACCEPT_PROVIDER_ADMIN_INVITATION",
      "SESSION_CLEANUP",
    ]);
  });

  it("does not grant FULL login from empty categories alone", () => {
    expect(loginCapability(categorylessIdentity())).toBe("VERIFICATION_ONLY");
    expect(resolveAuthenticatedCapability(categorylessIdentity())).toBe(
      "PROVIDER_ADMIN_INVITATION_ONBOARDING",
    );
  });

  it("grants FULL from enabled provider_admin without reading Provider tables", () => {
    expect(
      resolveAuthenticatedCapability(categorylessIdentity(), {
        providerAdminEnabled: true,
      }),
    ).toBe("FULL");
  });

  it("keeps Authentication invitation onboarding free of Providers imports", async () => {
    const source = await readFile(
      join(
        process.cwd(),
        "src/modules/authentication/infrastructure/prisma-provider-invitation-onboarding.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/modules\/providers/u);
    expect(source).toMatch(/accountCategories:\s*\[\]/u);
    expect(source).toMatch(/accountCategory:\s*null/u);
  });
});
