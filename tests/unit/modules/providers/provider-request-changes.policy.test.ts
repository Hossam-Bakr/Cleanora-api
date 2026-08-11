import {
  assertRequestChangesReason,
  assertRequestChangesTransition,
  normalizeStaffDecisionReason,
} from "../../../../src/modules/providers/domain/provider-request-changes.policy.js";
import {
  canMutatePreApprovalContent,
  canSubmitProviderApplication,
  canManageProviderInvitations,
  canManageProviderMembers,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import type { ProviderAuthorizationFacts } from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

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
    applicationStatus: "CHANGES_REQUESTED",
    operationalStatus: "INACTIVE",
    ...overrides,
  };
}

describe("US7 request-changes policy (T083)", () => {
  it("requires a trimmed non-empty reason and only PENDING_REVIEW → CHANGES_REQUESTED", () => {
    expect(normalizeStaffDecisionReason("  fix logo  ")).toBe("fix logo");
    expect(() => assertRequestChangesReason("")).toThrow(AppError);
    expect(() => assertRequestChangesReason("   ")).toThrow(AppError);
    expect(() => assertRequestChangesReason("needs clearer Arabic")).not.toThrow();

    expect(() =>
      assertRequestChangesTransition("PENDING_REVIEW", "CHANGES_REQUESTED"),
    ).not.toThrow();
    expect(() =>
      assertRequestChangesTransition("DRAFT", "CHANGES_REQUESTED"),
    ).toThrow(AppError);
    expect(() =>
      assertRequestChangesTransition("APPROVED", "CHANGES_REQUESTED"),
    ).toThrow(AppError);
  });

  it("restores Application Owner edit/submit without membership or invitations", () => {
    const facts = ownerFacts();
    expect(canMutatePreApprovalContent(facts)).toBe(true);
    expect(canSubmitProviderApplication(facts)).toBe(true);
    expect(canManageProviderInvitations(facts)).toBe(false);
    expect(canManageProviderMembers(facts)).toBe(false);
    expect(facts.membership).toBeNull();
  });
});
