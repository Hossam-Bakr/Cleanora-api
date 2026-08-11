import {
  canEditProviderProfileOrContacts,
  canManageAsOwner,
  canManageProviderInvitations,
  canManageProviderMembers,
  canReadPrivateContacts,
  canReadProviderPreview,
  canReadProviderProjections,
  canSubmitProviderApplication,
  decideProviderOperation,
  resolveActorRelationship,
  type ProviderAuthorizationFacts,
  type ProviderOperation,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";

function facts(
  overrides: Partial<ProviderAuthorizationFacts> = {},
): ProviderAuthorizationFacts {
  return {
    actorUserId: "actor-1",
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

const OPERATIONS: readonly ProviderOperation[] = [
  "READ_PROFILE",
  "READ_CONTACTS",
  "READ_PREVIEW",
  "READ_PROJECTIONS",
  "EDIT_PROFILE_OR_CONTACTS",
  "MUTATE_PRE_APPROVAL",
  "SUBMIT",
  "MANAGE_INVITATIONS",
  "MANAGE_MEMBERS",
  "MANAGE_AS_OWNER",
];

describe("US12 provider authorization matrix (T129)", () => {
  it("denies global provider_admin without exact Provider membership", () => {
    const globalOnly = facts({
      providerAdminEnabled: true,
      applicationStatus: "APPROVED",
      membership: null,
    });
    expect(resolveActorRelationship(globalOnly)).toBe("NONE");
    for (const operation of OPERATIONS) {
      expect(decideProviderOperation(globalOnly, operation).allowed).toBe(
        false,
      );
    }
  });

  it("denies active ADMIN membership for a different Provider scope", () => {
    // Membership facts are always for the requested Provider id; absence means
    // no access even when the caller claims another Provider membership.
    const otherProviderAdmin = facts({
      actorUserId: "admin-b",
      applicationOwnerUserId: "owner-a",
      providerAdminEnabled: true,
      applicationStatus: "APPROVED",
      membership: null,
    });
    expect(canReadPrivateContacts(otherProviderAdmin)).toBe(false);
    expect(
      decideProviderOperation(otherProviderAdmin, "READ_CONTACTS"),
    ).toEqual({ allowed: false, denialCode: "PROVIDER_NOT_FOUND" });
  });

  it("allows Application Owner reads/edits/submit only in editable drafts", () => {
    const draftOwner = facts({
      actorUserId: "owner-1",
      applicationOwnerUserId: "owner-1",
      applicationStatus: "DRAFT",
    });
    expect(resolveActorRelationship(draftOwner)).toBe("APPLICATION_OWNER");
    expect(canEditProviderProfileOrContacts(draftOwner)).toBe(true);
    expect(canSubmitProviderApplication(draftOwner)).toBe(true);
    expect(canManageProviderInvitations(draftOwner)).toBe(false);
    expect(canManageProviderMembers(draftOwner)).toBe(false);

    const pendingOwner = facts({
      actorUserId: "owner-1",
      applicationOwnerUserId: "owner-1",
      applicationStatus: "PENDING_REVIEW",
    });
    expect(canEditProviderProfileOrContacts(pendingOwner)).toBe(false);
    expect(canReadPrivateContacts(pendingOwner)).toBe(true);
    expect(
      decideProviderOperation(pendingOwner, "EDIT_PROFILE_OR_CONTACTS"),
    ).toMatchObject({
      allowed: false,
      denialCode: "PROVIDER_STATE_CONFLICT",
    });
  });

  it("allows post-approval OWNER and ADMIN content management with exact scope", () => {
    const approvedOwner = facts({
      actorUserId: "owner-1",
      applicationOwnerUserId: "owner-1",
      applicationStatus: "APPROVED",
      providerAdminEnabled: true,
      membership: { level: "OWNER", status: "ACTIVE" },
    });
    expect(canManageAsOwner(approvedOwner)).toBe(true);
    expect(resolveActorRelationship(approvedOwner)).toBe("OWNER");
    expect(canManageProviderInvitations(approvedOwner)).toBe(true);
    expect(canEditProviderProfileOrContacts(approvedOwner)).toBe(true);

    const approvedAdmin = facts({
      actorUserId: "admin-1",
      applicationOwnerUserId: "owner-1",
      applicationStatus: "APPROVED",
      providerAdminEnabled: true,
      membership: { level: "ADMIN", status: "ACTIVE" },
    });
    expect(resolveActorRelationship(approvedAdmin)).toBe("ADMIN");
    expect(canReadProviderPreview(approvedAdmin)).toBe(true);
    expect(canEditProviderProfileOrContacts(approvedAdmin)).toBe(true);
    expect(canSubmitProviderApplication(approvedAdmin)).toBe(false);
    expect(canManageProviderInvitations(approvedAdmin)).toBe(false);
    expect(canManageAsOwner(approvedAdmin)).toBe(false);
  });

  it("allows Staff Admin private reads without Provider membership", () => {
    const staff = facts({
      actorUserId: "staff-1",
      staffAdmin: true,
      applicationStatus: "PENDING_REVIEW",
    });
    expect(resolveActorRelationship(staff)).toBe("STAFF");
    expect(canReadPrivateContacts(staff)).toBe(true);
    expect(canReadProviderProjections(staff)).toBe(true);
    expect(canEditProviderProfileOrContacts(staff)).toBe(false);
  });

  it("never trusts caller-claimed membership that is inactive or missing admin grant", () => {
    const inactiveMember = facts({
      actorUserId: "admin-1",
      applicationStatus: "APPROVED",
      providerAdminEnabled: true,
      membership: { level: "ADMIN", status: "DISABLED" },
    });
    expect(canReadPrivateContacts(inactiveMember)).toBe(false);

    const memberWithoutGlobal = facts({
      actorUserId: "admin-1",
      applicationStatus: "APPROVED",
      providerAdminEnabled: false,
      membership: { level: "ADMIN", status: "ACTIVE" },
    });
    expect(canReadPrivateContacts(memberWithoutGlobal)).toBe(false);
  });

  it("does not treat application ownership as Provider authority after approval", () => {
    const staleApplicant = facts({
      actorUserId: "owner-1",
      applicationOwnerUserId: "owner-1",
      applicationStatus: "APPROVED",
      membership: null,
      providerAdminEnabled: false,
    });
    expect(resolveActorRelationship(staleApplicant)).toBe("NONE");
    expect(canReadPrivateContacts(staleApplicant)).toBe(false);
    expect(canReadProviderPreview(staleApplicant)).toBe(false);
    expect(canEditProviderProfileOrContacts(staleApplicant)).toBe(false);
  });

  it("denies every non-Staff relationship when current identity is inactive", () => {
    const inactiveOwner = facts({
      actorUserId: "owner-1",
      actorActive: false,
      applicationOwnerUserId: "owner-1",
      applicationStatus: "APPROVED",
      providerAdminEnabled: true,
      membership: { level: "OWNER", status: "ACTIVE" },
    });
    expect(resolveActorRelationship(inactiveOwner)).toBe("NONE");
    expect(canReadPrivateContacts(inactiveOwner)).toBe(false);
    expect(canEditProviderProfileOrContacts(inactiveOwner)).toBe(false);
    expect(canManageProviderInvitations(inactiveOwner)).toBe(false);
    expect(canManageProviderMembers(inactiveOwner)).toBe(false);

    expect(
      resolveActorRelationship(
        facts({ actorActive: false, staffAdmin: true }),
      ),
    ).toBe("STAFF");
  });

  it.each([
    ["READ_PROFILE", "PROVIDER_NOT_FOUND"],
    ["READ_CONTACTS", "PROVIDER_NOT_FOUND"],
    ["SUBMIT", "PROVIDER_NOT_FOUND"],
    ["MANAGE_INVITATIONS", "PROVIDER_NOT_FOUND"],
  ] as const)(
    "maps unauthorized %s to safe denial %s",
    (operation, denialCode) => {
      const stranger = facts({
        actorUserId: "stranger",
        applicationStatus: "APPROVED",
      });
      expect(decideProviderOperation(stranger, operation)).toEqual({
        allowed: false,
        denialCode,
      });
    },
  );
});
