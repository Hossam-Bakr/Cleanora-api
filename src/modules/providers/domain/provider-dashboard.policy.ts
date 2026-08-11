import type {
  MarketplaceReadiness,
  MarketplaceReadinessGateKey,
  ProfileCompletion,
  ProfileCompletionCheckCode,
  ProviderApplicationStatus,
  ProviderOperationalStatus,
} from "./providers.types.js";

export type ProviderNextAction =
  | {
      readonly code: "COMPLETE_PROFILE";
      readonly missingRequirementCodes: readonly ProfileCompletionCheckCode[];
    }
  | { readonly code: "SUBMIT_APPLICATION" }
  | { readonly code: "WAIT_FOR_STAFF_REVIEW" }
  | { readonly code: "APPLICATION_REJECTED" }
  | { readonly code: "REMEDIATE_SUSPENSION" }
  | {
      readonly code: "BLOCKED_BY_PHASE";
      readonly gateKey: MarketplaceReadinessGateKey;
      readonly blockerCodes: readonly string[];
      readonly owningPhase: string;
    };

export interface ProviderSettingsMediaUsage {
  readonly galleryImageCount: number;
  readonly galleryVideoCount: number;
  readonly galleryImageLimit: number;
  readonly galleryVideoLimit: number;
  readonly readyGalleryImageCount: number;
}

export interface ProviderSettingsProjection {
  readonly accountSecurity: { readonly href: string };
  readonly profile: {
    readonly complete: boolean;
    readonly canEdit: boolean;
    readonly href: string;
  };
  readonly privateContacts: {
    readonly configured: boolean;
    readonly canView: boolean;
    readonly canEdit: boolean;
    readonly href: string;
  };
  readonly media: {
    readonly usage: ProviderSettingsMediaUsage;
    readonly canEdit: boolean;
    readonly href: string;
  };
  readonly members: {
    readonly activeAdminCount: number;
    readonly pendingInvitationCount: number;
    readonly canManage: boolean;
    readonly href: string;
  };
  readonly statusHistory: {
    readonly applicationStatus: ProviderApplicationStatus;
    readonly operationalStatus: ProviderOperationalStatus;
    readonly href: string;
  };
  readonly privacy: { readonly directContactVisibleToCustomers: false };
  readonly notifications: {
    readonly mandatoryReviewEmails: true;
    readonly optionalPreferencesAvailable: false;
  };
}

/**
 * Pure next-owner-action projection (SC-015). Never collapses readiness into
 * one ambiguous percentage.
 */
export function deriveProviderNextAction(input: {
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
  readonly completion: ProfileCompletion;
  readonly readiness: MarketplaceReadiness;
}): ProviderNextAction {
  if (input.operationalStatus === "SUSPENDED") {
    return { code: "REMEDIATE_SUSPENSION" };
  }
  if (input.applicationStatus === "REJECTED") {
    return { code: "APPLICATION_REJECTED" };
  }
  if (input.applicationStatus === "PENDING_REVIEW") {
    return { code: "WAIT_FOR_STAFF_REVIEW" };
  }

  if (
    input.applicationStatus === "DRAFT" ||
    input.applicationStatus === "CHANGES_REQUESTED"
  ) {
    if (input.completion.percentage < 100) {
      return {
        code: "COMPLETE_PROFILE",
        missingRequirementCodes: input.completion.missingRequirementCodes,
      };
    }
    return { code: "SUBMIT_APPLICATION" };
  }

  // APPROVED
  if (input.completion.percentage < 100) {
    return {
      code: "COMPLETE_PROFILE",
      missingRequirementCodes: input.completion.missingRequirementCodes,
    };
  }

  const blocker = input.readiness.gates.find(
    (gate) =>
      gate.key !== "profileComplete" &&
      gate.key !== "applicationApproved" &&
      !gate.satisfied &&
      gate.status !== "NOT_REQUIRED",
  );
  if (blocker !== undefined) {
    return {
      code: "BLOCKED_BY_PHASE",
      gateKey: blocker.key,
      blockerCodes: blocker.blockerCodes,
      owningPhase: blocker.owningPhase,
    };
  }

  return {
    code: "BLOCKED_BY_PHASE",
    gateKey: "eligibleForPublicBrowse",
    blockerCodes: ["PUBLIC_BROWSE_DEFERRED_R1_P12"],
    owningPhase: "R1-P12",
  };
}

/**
 * Capability/status settings cards only — no generic settings persistence and
 * no private contact values (FR-075–FR-078).
 */
export function buildProviderSettingsProjection(input: {
  readonly providerId: string;
  readonly profileComplete: boolean;
  readonly canEditProfile: boolean;
  readonly privateContactsConfigured: boolean;
  readonly canViewPrivateContacts: boolean;
  readonly canEditPrivateContacts: boolean;
  readonly mediaUsage: ProviderSettingsMediaUsage;
  readonly canEditMedia: boolean;
  readonly activeAdminCount: number;
  readonly pendingInvitationCount: number;
  readonly canManageMembers: boolean;
  readonly applicationStatus: ProviderApplicationStatus;
  readonly operationalStatus: ProviderOperationalStatus;
}): ProviderSettingsProjection {
  const base = `/providers/${input.providerId}`;
  return {
    accountSecurity: { href: "/account/security" },
    profile: {
      complete: input.profileComplete,
      canEdit: input.canEditProfile,
      href: `${base}/profile`,
    },
    privateContacts: {
      configured: input.privateContactsConfigured,
      canView: input.canViewPrivateContacts,
      canEdit: input.canEditPrivateContacts,
      href: `${base}/contacts`,
    },
    media: {
      usage: input.mediaUsage,
      canEdit: input.canEditMedia,
      href: `${base}/media`,
    },
    members: {
      activeAdminCount: input.activeAdminCount,
      pendingInvitationCount: input.pendingInvitationCount,
      canManage: input.canManageMembers,
      href: `${base}/members`,
    },
    statusHistory: {
      applicationStatus: input.applicationStatus,
      operationalStatus: input.operationalStatus,
      href: `${base}/history`,
    },
    privacy: { directContactVisibleToCustomers: false },
    notifications: {
      mandatoryReviewEmails: true,
      optionalPreferencesAvailable: false,
    },
  };
}
