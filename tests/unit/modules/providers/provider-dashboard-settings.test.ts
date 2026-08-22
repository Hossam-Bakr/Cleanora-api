import { calculateProfileCompletion } from "../../../../src/modules/providers/domain/provider-completion.policy.js";
import { calculateMarketplaceReadiness } from "../../../../src/modules/providers/domain/provider-readiness.policy.js";
import {
  buildProviderSettingsProjection,
  deriveProviderNextAction,
} from "../../../../src/modules/providers/domain/provider-dashboard.policy.js";
import type { ProfileCompletionCheckCode } from "../../../../src/modules/providers/domain/providers.types.js";

const completeFacts = {
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
};

describe("US9 dashboard next-action and settings (T099)", () => {
  it("directs incomplete draft owners to COMPLETE_PROFILE with missing codes", () => {
    const completion = calculateProfileCompletion({
      ...completeFacts,
      displayNameAr: null,
      logoReady: false,
    });
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "DRAFT",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: completion.percentage,
    });

    expect(
      deriveProviderNextAction({
        applicationStatus: "DRAFT",
        operationalStatus: "INACTIVE",
        completion,
        readiness,
      }),
    ).toEqual({
      code: "COMPLETE_PROFILE",
      missingRequirementCodes: [
        "ARABIC_DISPLAY_NAME",
        "READY_LOGO",
      ] satisfies ProfileCompletionCheckCode[],
    });
  });

  it("directs complete draft/changes-requested owners to SUBMIT_APPLICATION", () => {
    const completion = calculateProfileCompletion(completeFacts);
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "DRAFT",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
    });

    expect(
      deriveProviderNextAction({
        applicationStatus: "DRAFT",
        operationalStatus: "INACTIVE",
        completion,
        readiness,
      }),
    ).toEqual({ code: "SUBMIT_APPLICATION" });

    expect(
      deriveProviderNextAction({
        applicationStatus: "CHANGES_REQUESTED",
        operationalStatus: "INACTIVE",
        completion,
        readiness,
      }),
    ).toEqual({ code: "SUBMIT_APPLICATION" });
  });

  it("waits for staff while PENDING_REVIEW and surfaces rejection/suspension", () => {
    const completion = calculateProfileCompletion(completeFacts);
    const readiness = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "PENDING_REVIEW",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
    });

    expect(
      deriveProviderNextAction({
        applicationStatus: "PENDING_REVIEW",
        operationalStatus: "INACTIVE",
        completion,
        readiness,
      }),
    ).toEqual({ code: "WAIT_FOR_STAFF_REVIEW" });

    expect(
      deriveProviderNextAction({
        applicationStatus: "REJECTED",
        operationalStatus: "INACTIVE",
        completion,
        readiness,
      }),
    ).toEqual({ code: "APPLICATION_REJECTED" });

    expect(
      deriveProviderNextAction({
        applicationStatus: "APPROVED",
        operationalStatus: "SUSPENDED",
        completion,
        readiness,
      }),
    ).toEqual({ code: "REMEDIATE_SUSPENSION" });
  });

  it("surfaces the first readiness blocker and owning phase after approval", () => {
    const completion = calculateProfileCompletion(completeFacts);
    const individual = calculateMarketplaceReadiness({
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
    });
    expect(
      deriveProviderNextAction({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        completion,
        readiness: individual,
      }),
    ).toMatchObject({
      code: "BLOCKED_BY_PHASE",
      gateKey: "payoutDestinationReady",
      owningPhase: "R1-P06",
    });

    const company = calculateMarketplaceReadiness({
      kind: "REGISTERED_COMPANY",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
    });
    expect(
      deriveProviderNextAction({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        completion,
        readiness: company,
      }),
    ).toMatchObject({
      code: "BLOCKED_BY_PHASE",
      gateKey: "documentsVerified",
      owningPhase: "R1-P06",
      blockerCodes: ["COMPANY_DOCUMENTS_DEFERRED_R1_P06"],
    });
  });

  it("builds capability-only settings without contact values or generic store", () => {
    const settings = buildProviderSettingsProjection({
      profileComplete: false,
      canEditProfile: true,
      privateContactsConfigured: true,
      canViewPrivateContacts: true,
      canEditPrivateContacts: true,
      mediaUsage: {
        galleryImageCount: 1,
        galleryVideoCount: 0,
        galleryImageLimit: 12,
        galleryVideoLimit: 2,
        readyGalleryImageCount: 1,
      },
      canEditMedia: true,
      activeAdminCount: 0,
      pendingInvitationCount: 0,
      canManageMembers: false,
      applicationStatus: "DRAFT",
      operationalStatus: "INACTIVE",
      providerId: "provider-1",
      documentsVerifiedStatus: "BLOCKED",
      documentsVerifiedSatisfied: false,
      payoutDestinationReady: false,
    });

    expect(settings).toMatchObject({
      accountSecurity: { href: "/account/security" },
      profile: {
        complete: false,
        canEdit: true,
        href: "/providers/provider-1/profile",
      },
      privateContacts: {
        configured: true,
        canView: true,
        canEdit: true,
        href: "/providers/provider-1/contacts",
      },
      media: {
        canEdit: true,
        href: "/providers/provider-1/media",
      },
      members: {
        activeAdminCount: 0,
        pendingInvitationCount: 0,
        canManage: false,
      },
      verification: {
        status: "BLOCKED",
        satisfied: false,
        href: "/providers/provider-1/verification",
      },
      payoutDestinations: {
        ready: false,
        href: "/providers/provider-1/payout-destinations",
      },
      statusHistory: {
        applicationStatus: "DRAFT",
        operationalStatus: "INACTIVE",
        href: "/providers/provider-1/history",
      },
      privacy: { directContactVisibleToCustomers: false },
      notifications: {
        mandatoryReviewEmails: true,
        optionalPreferencesAvailable: false,
      },
    });

    const serialized = JSON.stringify(settings);
    expect(serialized).not.toMatch(/@|operationalEmail|whatsapp|\+20/i);
    expect(settings).not.toHaveProperty("preferences");
    expect(settings).not.toHaveProperty("settingsStore");
    expect(Object.keys(settings).sort()).toEqual(
      [
        "accountSecurity",
        "media",
        "members",
        "notifications",
        "payoutDestinations",
        "privacy",
        "privateContacts",
        "profile",
        "statusHistory",
        "verification",
      ].sort(),
    );
  });

  it("falls through to public-browse deferred when every intermediate gate is satisfied or NOT_REQUIRED", () => {
    const completion = calculateProfileCompletion(completeFacts);
    expect(completion.percentage).toBe(100);
    const readiness = {
      eligibleForPublicBrowse: false,
      gates: [
        {
          key: "profileComplete",
          satisfied: true,
          applicable: true,
          status: "SATISFIED",
          blockerCodes: [],
          owningPhase: "R1-P05",
        },
        {
          key: "applicationApproved",
          satisfied: true,
          applicable: true,
          status: "SATISFIED",
          blockerCodes: [],
          owningPhase: "R1-P05",
        },
        {
          key: "documentsVerified",
          satisfied: true,
          applicable: false,
          status: "NOT_REQUIRED",
          blockerCodes: [],
          owningPhase: "R1-P06",
        },
        {
          key: "payoutDestinationReady",
          satisfied: false,
          applicable: false,
          status: "NOT_REQUIRED",
          blockerCodes: [],
          owningPhase: "R1-P07",
        },
        {
          key: "eligibleForPublicBrowse",
          satisfied: false,
          applicable: true,
          status: "NOT_STARTED",
          blockerCodes: ["PUBLIC_BROWSE_DEFERRED_R1_P12"],
          owningPhase: "R1-P12",
        },
      ],
    } as unknown as ReturnType<typeof calculateMarketplaceReadiness>;

    expect(
      deriveProviderNextAction({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        completion,
        readiness,
      }),
    ).toEqual({
      code: "BLOCKED_BY_PHASE",
      gateKey: "eligibleForPublicBrowse",
      blockerCodes: ["PUBLIC_BROWSE_DEFERRED_R1_P12"],
      owningPhase: "R1-P12",
    });
  });
});
