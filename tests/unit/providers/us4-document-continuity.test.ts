import {
  canCreateDocumentSuccessor,
  predecessorRemainsEffective,
  successorApprovalEffect,
} from "../../../src/modules/providers/domain/provider-document-continuity.policy.js";

describe("R1-P06 US4 document continuity", () => {
  const now = new Date("2026-08-13T00:00:00Z");
  it("preserves only an unexpired unchallenged approved predecessor", () => {
    expect(predecessorRemainsEffective({ predecessorStatus: "APPROVED", predecessorExpiresAt: null, successorStatus: "SUBMITTED", challenged: false, now })).toBe(true);
    expect(predecessorRemainsEffective({ predecessorStatus: "APPROVED", predecessorExpiresAt: null, successorStatus: "REJECTED", challenged: false, now })).toBe(true);
    expect(predecessorRemainsEffective({ predecessorStatus: "APPROVED", predecessorExpiresAt: null, successorStatus: "SUBMITTED", challenged: true, now })).toBe(false);
    expect(predecessorRemainsEffective({ predecessorStatus: "APPROVED", predecessorExpiresAt: now, successorStatus: "SUBMITTED", challenged: false, now })).toBe(false);
  });
  it("moves the effective pointer atomically on successor approval", () => {
    expect(successorApprovalEffect({ predecessorWasEffective: true, successorStatus: "SUBMITTED" })).toEqual({ predecessorStatus: "SUPERSEDED", moveEffectivePointer: true });
    expect(canCreateDocumentSuccessor("APPROVED")).toBe(true);
    expect(canCreateDocumentSuccessor("SUBMITTED")).toBe(false);
  });
});
