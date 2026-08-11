import {
  assertApprovalLeavesInactive,
  assertApprovalNeverSetsLive,
  evaluateApprovalReadinessAfterApprove,
  isCompleteApprovalOutcome,
} from "../../../../src/modules/providers/domain/provider-approval.policy.js";
import { calculateMarketplaceReadiness } from "../../../../src/modules/providers/domain/provider-readiness.policy.js";
import { AppError } from "../../../../src/shared/errors/app-error.js";

describe("US6 provider approval policy (T074)", () => {
  it("forbids LIVE promotion on approval and keeps operational INACTIVE", () => {
    expect(() => assertApprovalNeverSetsLive("LIVE")).toThrow(AppError);
    expect(() => assertApprovalNeverSetsLive("INACTIVE")).not.toThrow();
    expect(assertApprovalLeavesInactive("INACTIVE")).toBe("INACTIVE");
    expect(() => assertApprovalLeavesInactive("LIVE")).toThrow(AppError);
  });

  it("satisfies applicationApproved without satisfying later or LIVE gates", () => {
    const readiness = evaluateApprovalReadinessAfterApprove({
      kind: "INDIVIDUAL_TEAM",
      profileCompletionPercentage: 100,
    });
    expect(readiness.eligibleForPublicBrowse).toBe(false);

    const byKey = Object.fromEntries(
      readiness.gates.map((gate) => [gate.key, gate]),
    );
    expect(byKey["applicationApproved"]?.satisfied).toBe(true);
    expect(byKey["operationalLive"]?.satisfied).toBe(false);
    expect(byKey["eligibleForPublicBrowse"]?.satisfied).toBe(false);
    expect(byKey["payoutDestinationReady"]?.satisfied).toBe(false);
    expect(byKey["documentsVerified"]?.status).toBe("NOT_REQUIRED");

    const company = calculateMarketplaceReadiness({
      kind: "REGISTERED_COMPANY",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
    });
    expect(
      company.gates.find((gate) => gate.key === "documentsVerified")?.satisfied,
    ).toBe(false);
  });

  it("treats approval as complete only when every ownership component matches", () => {
    expect(
      isCompleteApprovalOutcome({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        ownerUserId: "owner-1",
        hasProviderOwnerCategory: true,
        providerAdminEnabled: true,
        hasActiveOwnerMembership: true,
        hasApprovedHistoryForCycle: true,
        hasApprovedOutboxIntent: true,
      }),
    ).toBe(true);

    expect(
      isCompleteApprovalOutcome({
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        ownerUserId: "owner-1",
        hasProviderOwnerCategory: true,
        providerAdminEnabled: true,
        hasActiveOwnerMembership: false,
        hasApprovedHistoryForCycle: true,
        hasApprovedOutboxIntent: true,
      }),
    ).toBe(false);
  });
});
