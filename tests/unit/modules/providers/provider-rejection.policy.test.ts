import {
  assertRejectionReason,
  assertRejectionTransition,
  assertRejectionLeavesNoAuthorityEffects,
} from "../../../../src/modules/providers/domain/provider-rejection.policy.js";
import {
  assertRejectedRestartDenied,
  isTerminalApplicationStatus,
} from "../../../../src/modules/providers/domain/provider-lifecycle.policy.js";
import {
  canMutatePreApprovalContent,
  canSubmitProviderApplication,
  canManageProviderInvitations,
} from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import type { ProviderAuthorizationFacts } from "../../../../src/modules/providers/domain/provider-authorization.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

function rejectedOwnerFacts(): ProviderAuthorizationFacts {
  return {
    actorUserId: "owner-1",
    actorActive: true,
    applicationOwnerUserId: "owner-1",
    membership: null,
    staffAdmin: false,
    providerAdminEnabled: false,
    applicationStatus: "REJECTED",
    operationalStatus: "INACTIVE",
  };
}

describe("US8 terminal rejection policy (T090)", () => {
  it("requires reason and only PENDING_REVIEW → REJECTED as terminal", () => {
    expect(() => assertRejectionReason("")).toThrow(AppError);
    expect(() => assertRejectionReason("  ")).toThrow(AppError);
    expect(() => assertRejectionReason("unsuitable documents")).not.toThrow();

    expect(() =>
      assertRejectionTransition("PENDING_REVIEW", "REJECTED"),
    ).not.toThrow();
    expect(() => assertRejectionTransition("DRAFT", "REJECTED")).toThrow(
      AppError,
    );
    expect(isTerminalApplicationStatus("REJECTED")).toBe(true);
    expect(() => assertRejectedRestartDenied("REJECTED")).toThrow(AppError);
  });

  it("blocks edit/submit/invite and asserts no authority side effects", () => {
    const facts = rejectedOwnerFacts();
    expect(canMutatePreApprovalContent(facts)).toBe(false);
    expect(canSubmitProviderApplication(facts)).toBe(false);
    expect(canManageProviderInvitations(facts)).toBe(false);

    expect(() =>
      assertRejectionLeavesNoAuthorityEffects({
        memberCount: 0,
        invitationCount: 0,
        hasProviderOwnerCategory: false,
        providerAdminEnabled: false,
      }),
    ).not.toThrow();

    expect(() =>
      assertRejectionLeavesNoAuthorityEffects({
        memberCount: 1,
        invitationCount: 0,
        hasProviderOwnerCategory: false,
        providerAdminEnabled: false,
      }),
    ).toThrow(AppError);
  });
});
