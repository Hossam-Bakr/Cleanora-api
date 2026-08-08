import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { AuthenticationPrincipal } from "../../../../src/modules/authentication/authentication.public.js";
import {
  authorizeCategoryProfileSelf,
  authorizeContactPrefsPrivacySelf,
  authorizeCustomerSelf,
  authorizeSharedImageOrAddressSelf,
} from "../../../../src/modules/customers/domain/customer-self.policy.js";

const userId = "user-1";

function principal(
  overrides: Partial<AuthenticationPrincipal> = {},
): AuthenticationPrincipal {
  return {
    userId,
    sessionId: "session-1",
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
    ...overrides,
  };
}

describe("FR-028 customer SELF policy", () => {
  it("allows category profile access for ACTIVE verified matching category + SELF", () => {
    expect(
      authorizeCategoryProfileSelf({
        principal: principal(),
        resourceOwnerUserId: userId,
        category: "INDIVIDUAL",
      }),
    ).toEqual({ allowed: true });
  });

  it("denies category profile when only pending enrollment exists", () => {
    expect(
      authorizeCategoryProfileSelf({
        principal: principal({
          verifiedCategories: [],
          pendingCategories: ["INDIVIDUAL"],
        }),
        resourceOwnerUserId: userId,
        category: "INDIVIDUAL",
      }),
    ).toEqual({ allowed: false, denialCode: "CATEGORY_NOT_VERIFIED" });
  });

  it("allows contact/preferences/privacy for pending-only supported enrollment", () => {
    expect(
      authorizeContactPrefsPrivacySelf({
        principal: principal({
          verifiedCategories: [],
          pendingCategories: ["COMPANY"],
          accountCategories: ["COMPANY"],
        }),
        resourceOwnerUserId: userId,
      }),
    ).toEqual({ allowed: true });
  });

  it("denies shared image/address when no verified supported category exists", () => {
    expect(
      authorizeSharedImageOrAddressSelf({
        principal: principal({
          verifiedCategories: [],
          pendingCategories: ["ENGINEER"],
          accountCategories: ["ENGINEER"],
        }),
        resourceOwnerUserId: userId,
      }),
    ).toEqual({ allowed: false, denialCode: "CATEGORY_NOT_VERIFIED" });
  });

  it.each(["SUSPENDED", "BANNED"] as const)(
    "denies every family for %s identities",
    (status) => {
      const inactive = principal({ status });
      const input = {
        principal: inactive,
        resourceOwnerUserId: userId,
        category: "INDIVIDUAL" as const,
      };

      expect(authorizeCategoryProfileSelf(input)).toEqual({
        allowed: false,
        denialCode: "IDENTITY_NOT_ACTIVE",
      });
      expect(authorizeSharedImageOrAddressSelf(input)).toEqual({
        allowed: false,
        denialCode: "IDENTITY_NOT_ACTIVE",
      });
      expect(authorizeContactPrefsPrivacySelf(input)).toEqual({
        allowed: false,
        denialCode: "IDENTITY_NOT_ACTIVE",
      });
    },
  );

  it("denies contact/preferences/privacy when no supported category is enrolled", () => {
    expect(
      authorizeContactPrefsPrivacySelf({
        principal: principal({
          accountCategories: ["PROVIDER_OWNER"],
          verifiedCategories: ["PROVIDER_OWNER"],
          pendingCategories: [],
        }),
        resourceOwnerUserId: userId,
      }),
    ).toEqual({ allowed: false, denialCode: "CATEGORY_NOT_ENROLLED" });
  });

  it("denies cross-owner access without implying deletion", () => {
    expect(
      authorizeCustomerSelf("categoryProfile", {
        principal: principal(),
        resourceOwnerUserId: "other-user",
        category: "INDIVIDUAL",
      }),
    ).toEqual({ allowed: false, denialCode: "OWNERSHIP_DENIED" });
  });

  it("does not depend on customer role grants or resource.self.* permissions", async () => {
    const source = await readFile(
      join(
        process.cwd(),
        "src/modules/customers/domain/customer-self.policy.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/resource\.self\./u);
    expect(source).not.toMatch(/["']customer["']/u);
    expect(source).not.toMatch(/permissionCodes/u);
    expect(source).not.toMatch(/ROLE_PERMISSION_MAP/u);
    expect(source).not.toMatch(/authorization\.catalog/u);
  });
});
