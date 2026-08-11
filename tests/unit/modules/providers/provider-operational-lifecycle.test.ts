import {
  assertApprovedForOperationalLifecycle,
  assertApplicationTransition,
  assertOperationalDecisionReason,
  assertOperationalTransition,
  canTransitionOperational,
  isTerminalApplicationStatus,
  reinstateOperationalTarget,
} from "../../../../src/modules/providers/domain/provider-lifecycle.policy.js";
import {
  canEditPostApprovalContent,
  canEditProviderProfileOrContacts,
  type ProviderAuthorizationFacts,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import { deriveProviderNextAction } from "../../../../src/modules/providers/domain/provider-dashboard.policy.js";
import { calculateMarketplaceReadiness } from "../../../../src/modules/providers/domain/provider-readiness.policy.js";
import { calculateProfileCompletion } from "../../../../src/modules/providers/domain/provider-completion.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

function approvedOwnerFacts(
  overrides: Partial<ProviderAuthorizationFacts> = {},
): ProviderAuthorizationFacts {
  return {
    actorUserId: "owner-1",
    actorActive: true,
    applicationOwnerUserId: "owner-1",
    membership: { level: "OWNER", status: "ACTIVE" },
    staffAdmin: false,
    providerAdminEnabled: true,
    applicationStatus: "APPROVED",
    operationalStatus: "SUSPENDED",
    ...overrides,
  };
}

describe("Provider operational lifecycle policy (T144)", () => {
  it("requires reasoned INACTIVE <-> SUSPENDED only and never LIVE on reinstate", () => {
    expect(() => assertOperationalDecisionReason("")).toThrow(AppError);
    expect(() => assertOperationalDecisionReason("   ")).toThrow(AppError);
    expect(assertOperationalDecisionReason("  policy breach  ")).toBe(
      "policy breach",
    );

    expect(canTransitionOperational("INACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionOperational("SUSPENDED", "INACTIVE")).toBe(true);
    expect(canTransitionOperational("INACTIVE", "LIVE")).toBe(false);
    expect(canTransitionOperational("SUSPENDED", "LIVE")).toBe(false);
    expect(canTransitionOperational("LIVE", "SUSPENDED")).toBe(false);

    expect(() =>
      assertOperationalTransition("INACTIVE", "SUSPENDED"),
    ).not.toThrow();
    expect(() =>
      assertOperationalTransition("SUSPENDED", "INACTIVE"),
    ).not.toThrow();
    expect(() => assertOperationalTransition("SUSPENDED", "LIVE")).toThrow(
      AppError,
    );
    expect(() => assertOperationalTransition("INACTIVE", "LIVE")).toThrow(
      AppError,
    );

    expect(reinstateOperationalTarget()).toBe("INACTIVE");
    expect(reinstateOperationalTarget()).not.toBe("LIVE");
  });

  it("limits operational lifecycle to APPROVED applications", () => {
    expect(() => assertApprovedForOperationalLifecycle("APPROVED")).not.toThrow();
    expect(() => assertApprovedForOperationalLifecycle("DRAFT")).toThrow(
      AppError,
    );
    expect(() =>
      assertApprovedForOperationalLifecycle("PENDING_REVIEW"),
    ).toThrow(AppError);
  });

  it("preserves OWNER/ADMIN management remediation while SUSPENDED", () => {
    const owner = approvedOwnerFacts();
    expect(canEditPostApprovalContent(owner)).toBe(true);
    expect(canEditProviderProfileOrContacts(owner)).toBe(true);

    const admin = approvedOwnerFacts({
      actorUserId: "admin-1",
      membership: { level: "ADMIN", status: "ACTIVE" },
    });
    expect(canEditPostApprovalContent(admin)).toBe(true);

    const completion = calculateProfileCompletion({
      eligibleCategoryVerified: true,
      matchingCustomerProfileComplete: true,
      displayNameAr: "اسم",
      descriptionAr: "وصف",
      operationalEmailNormalized: "ops@example.com",
      operationalPhoneE164: "+201012345678",
      activeCountryId: "country-eg",
      logoReady: true,
      coverReady: true,
      readyGalleryImageCount: 3,
    });
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "SUSPENDED",
      profileCompletionPercentage: completion.percentage,
    });
    expect(readiness.eligibleForPublicBrowse).toBe(false);
    expect(
      readiness.gates.find((gate) => gate.key === "operationalLive")?.satisfied,
    ).toBe(false);

    const next = deriveProviderNextAction({
      applicationStatus: "APPROVED",
      operationalStatus: "SUSPENDED",
      completion,
      readiness,
    });
    expect(next).toEqual({ code: "REMEDIATE_SUSPENSION" });
  });

  it("rejects illegal application transitions and treats APPROVED as terminal", () => {
    expect(() => assertApplicationTransition("DRAFT", "APPROVED")).toThrow(
      AppError,
    );
    expect(() =>
      assertApplicationTransition("PENDING_REVIEW", "APPROVED"),
    ).not.toThrow();
    expect(isTerminalApplicationStatus("APPROVED")).toBe(true);
    expect(isTerminalApplicationStatus("REJECTED")).toBe(true);
    expect(isTerminalApplicationStatus("CHANGES_REQUESTED")).toBe(false);
  });
});
