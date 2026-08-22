import { canCreateDocumentSuccessor, predecessorRemainsEffective, successorApprovalEffect } from "../../../src/modules/providers/domain/provider-document-continuity.policy.js";

describe("R1-P06 US4 document lifecycle", () => {
  it("preserves voluntary predecessor and supersedes it only on approval", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    expect(predecessorRemainsEffective({ predecessorStatus: "APPROVED", predecessorExpiresAt: null, challenged: false, successorStatus: "SUBMITTED", now })).toBe(true);
    expect(successorApprovalEffect({ predecessorWasEffective: true, successorStatus: "SUBMITTED" })).toEqual({ predecessorStatus: "SUPERSEDED", moveEffectivePointer: true });
    expect(canCreateDocumentSuccessor("REJECTED")).toBe(true);
    expect(canCreateDocumentSuccessor("DRAFT")).toBe(false);
  });
});
