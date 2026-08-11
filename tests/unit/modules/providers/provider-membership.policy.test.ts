import {
  adminForbiddenManagementCapabilities,
  canAdminEditApprovedContent,
  canDisableAdminMembership,
  canManageProviderInvitations,
  canManageProviderMembers,
  canOwnerManageAdmins,
  canSubmitProviderApplication,
  type ProviderAuthorizationFacts,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import { shouldEnableProviderAdminRole } from "../../../../src/modules/providers/domain/provider-invitation.policy.js";

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
    operationalStatus: "INACTIVE",
    ...overrides,
  };
}

function approvedAdminFacts(
  overrides: Partial<ProviderAuthorizationFacts> = {},
): ProviderAuthorizationFacts {
  return {
    actorUserId: "admin-1",
    actorActive: true,
    applicationOwnerUserId: "owner-1",
    membership: { level: "ADMIN", status: "ACTIVE" },
    staffAdmin: false,
    providerAdminEnabled: true,
    applicationStatus: "APPROVED",
    operationalStatus: "INACTIVE",
    ...overrides,
  };
}

describe("provider membership policy (T106)", () => {
  it("allows OWNER to manage invitations and members after approval", () => {
    const facts = approvedOwnerFacts();
    expect(canOwnerManageAdmins(facts)).toBe(true);
    expect(canManageProviderInvitations(facts)).toBe(true);
    expect(canManageProviderMembers(facts)).toBe(true);
  });

  it("denies ADMIN invitation/member/submit/kind management", () => {
    const facts = approvedAdminFacts();
    expect(canManageProviderInvitations(facts)).toBe(false);
    expect(canManageProviderMembers(facts)).toBe(false);
    expect(canSubmitProviderApplication(facts)).toBe(false);
    expect(canAdminEditApprovedContent(facts)).toBe(true);
    expect(
      adminForbiddenManagementCapabilities({
        canInvite: canManageProviderInvitations(facts),
        canManageMembers: canManageProviderMembers(facts),
        canSubmit: canSubmitProviderApplication(facts),
        canChangeKind: false,
      }),
    ).toBe(true);
  });

  it("soft-disable rules allow OWNER to disable ADMIN only", () => {
    expect(
      canDisableAdminMembership({
        actorIsApprovedOwner: true,
        targetLevel: "ADMIN",
        targetUserId: "admin-1",
        actorUserId: "owner-1",
      }),
    ).toBe(true);
    expect(
      canDisableAdminMembership({
        actorIsApprovedOwner: true,
        targetLevel: "OWNER",
        targetUserId: "owner-1",
        actorUserId: "owner-1",
      }),
    ).toBe(false);
  });

  it("reconciles global provider_admin from aggregate active authority", () => {
    expect(shouldEnableProviderAdminRole(0)).toBe(false);
    expect(shouldEnableProviderAdminRole(1)).toBe(true);
    expect(shouldEnableProviderAdminRole(2)).toBe(true);
  });

  it("denies invitations when global provider_admin is disabled", () => {
    expect(
      canManageProviderInvitations(
        approvedOwnerFacts({ providerAdminEnabled: false }),
      ),
    ).toBe(false);
  });
});
