import {
  canApplicationOwnerMutateContent,
  canApplicationOwnerSubmit,
  evaluateSubmissionBlockers,
  nextReviewCycle,
  assertCanSubmitApplication,
} from "../../../../src/modules/providers/domain/provider-submission.policy.js";
import {
  canManageProviderInvitations,
  canManageProviderMembers,
  canMutatePreApprovalContent,
  canSubmitProviderApplication,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import { PROFILE_COMPLETION_CHECK_CODES } from "../../../../src/modules/providers/domain/providers.types.js";
import type { ProviderAuthorizationFacts } from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import type { ProviderCompletionFacts } from "../../../../src/modules/providers/domain/provider-completion.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

function completeFacts(
  overrides: Partial<ProviderCompletionFacts> = {},
): ProviderCompletionFacts {
  return {
    eligibleCategoryVerified: true,
    matchingCustomerProfileComplete: true,
    displayNameAr: "اسم العرض",
    descriptionAr: "وصف عربي كامل",
    operationalEmailNormalized: "ops@example.com",
    operationalPhoneE164: "+201012345678",
    activeCountryId: "country-eg",
    logoReady: true,
    coverReady: true,
    readyGalleryImageCount: 3,
    ...overrides,
  };
}

function ownerFacts(
  overrides: Partial<ProviderAuthorizationFacts> = {},
): ProviderAuthorizationFacts {
  return {
    actorUserId: "owner-1",
    actorActive: true,
    applicationOwnerUserId: "owner-1",
    membership: null,
    staffAdmin: false,
    providerAdminEnabled: false,
    applicationStatus: "DRAFT",
    operationalStatus: "INACTIVE",
    ...overrides,
  };
}

describe("US5 provider submission policy (T063)", () => {
  it("allows Application Owner submit only from DRAFT or CHANGES_REQUESTED", () => {
    expect(canApplicationOwnerSubmit("DRAFT")).toBe(true);
    expect(canApplicationOwnerSubmit("CHANGES_REQUESTED")).toBe(true);
    expect(canApplicationOwnerSubmit("PENDING_REVIEW")).toBe(false);
    expect(canApplicationOwnerSubmit("APPROVED")).toBe(false);
    expect(canApplicationOwnerSubmit("REJECTED")).toBe(false);

    expect(() =>
      assertCanSubmitApplication({
        actorIsApplicationOwner: true,
        applicationStatus: "DRAFT",
      }),
    ).not.toThrow();

    expect(() =>
      assertCanSubmitApplication({
        actorIsApplicationOwner: true,
        applicationStatus: "PENDING_REVIEW",
      }),
    ).toThrow(AppError);

    expect(() =>
      assertCanSubmitApplication({
        actorIsApplicationOwner: false,
        applicationStatus: "DRAFT",
      }),
    ).toThrow(AppError);
  });

  it("locks Application Owner content edits during PENDING_REVIEW and REJECTED", () => {
    expect(canApplicationOwnerMutateContent("DRAFT")).toBe(true);
    expect(canApplicationOwnerMutateContent("CHANGES_REQUESTED")).toBe(true);
    expect(canApplicationOwnerMutateContent("PENDING_REVIEW")).toBe(false);
    expect(canApplicationOwnerMutateContent("REJECTED")).toBe(false);
    expect(canApplicationOwnerMutateContent("APPROVED")).toBe(false);

    expect(canMutatePreApprovalContent(ownerFacts())).toBe(true);
    expect(
      canMutatePreApprovalContent(
        ownerFacts({ applicationStatus: "PENDING_REVIEW" }),
      ),
    ).toBe(false);
    expect(
      canSubmitProviderApplication(
        ownerFacts({ applicationStatus: "CHANGES_REQUESTED" }),
      ),
    ).toBe(true);
    expect(
      canSubmitProviderApplication(
        ownerFacts({ applicationStatus: "PENDING_REVIEW" }),
      ),
    ).toBe(false);
  });

  it("denies invitations and membership management before approval", () => {
    expect(canManageProviderInvitations(ownerFacts())).toBe(false);
    expect(canManageProviderMembers(ownerFacts())).toBe(false);
    expect(
      canManageProviderInvitations(
        ownerFacts({ applicationStatus: "PENDING_REVIEW" }),
      ),
    ).toBe(false);
    expect(
      canManageProviderMembers(
        ownerFacts({ applicationStatus: "PENDING_REVIEW" }),
      ),
    ).toBe(false);

    const approvedOwner: ProviderAuthorizationFacts = {
      actorUserId: "owner-1",
      actorActive: true,
      applicationOwnerUserId: "owner-1",
      membership: { level: "OWNER", status: "ACTIVE" },
      staffAdmin: false,
      providerAdminEnabled: true,
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
    };
    expect(canManageProviderInvitations(approvedOwner)).toBe(true);
    expect(canManageProviderMembers(approvedOwner)).toBe(true);
  });

  it("aggregates every incomplete r1-p05-v1 blocker code together", () => {
    const empty = evaluateSubmissionBlockers(
      completeFacts({
        eligibleCategoryVerified: false,
        matchingCustomerProfileComplete: false,
        displayNameAr: "  ",
        descriptionAr: null,
        operationalEmailNormalized: null,
        operationalPhoneE164: "",
        activeCountryId: null,
        logoReady: false,
        coverReady: false,
        readyGalleryImageCount: 1,
      }),
    );

    expect(empty.ready).toBe(false);
    expect(empty.missingRequirementCodes).toEqual([
      ...PROFILE_COMPLETION_CHECK_CODES,
    ]);
    expect(empty.completion.policyVersion).toBe("r1-p05-v1");
    expect(empty.completion.percentage).toBe(0);
  });

  it("accepts a complete submission set and advances the review cycle counter", () => {
    const ready = evaluateSubmissionBlockers(completeFacts());
    expect(ready.ready).toBe(true);
    expect(ready.missingRequirementCodes).toEqual([]);
    expect(ready.completion.percentage).toBe(100);
    expect(nextReviewCycle(0)).toBe(1);
    expect(nextReviewCycle(1)).toBe(2);
  });

  it("rejects terminal REJECTED restart and unsupported withdrawal transitions", () => {
    expect(() =>
      assertCanSubmitApplication({
        actorIsApplicationOwner: true,
        applicationStatus: "REJECTED",
      }),
    ).toThrow(AppError);

    expect(() =>
      assertCanSubmitApplication({
        actorIsApplicationOwner: true,
        applicationStatus: "APPROVED",
      }),
    ).toThrow(AppError);
  });
});
