import {
  assertDocumentTransition,
  assertPayoutTransition,
  isDocumentTransitionAllowed,
  isPayoutTransitionAllowed,
} from "../../../src/modules/providers/domain/provider-verification.lifecycle.js";

describe("R1-P06 lifecycle transition tables", () => {
  it.each([
    ["DRAFT", "SUBMITTED"],
    ["SUBMITTED", "APPROVED"],
    ["SUBMITTED", "REJECTED"],
    ["SUBMITTED", "REPLACEMENT_REQUESTED"],
    ["APPROVED", "EXPIRED"],
    ["APPROVED", "INVALIDATED"],
    ["APPROVED", "REPLACEMENT_REQUESTED"],
    ["APPROVED", "SUPERSEDED"],
  ] as const)("allows document %s -> %s", (from, to) => {
    expect(isDocumentTransitionAllowed(from, to)).toBe(true);
    expect(() => assertDocumentTransition(from, to)).not.toThrow();
  });

  it.each([
    ["DRAFT", "APPROVED"],
    ["REJECTED", "DRAFT"],
    ["INVALIDATED", "APPROVED"],
    ["SUPERSEDED", "SUBMITTED"],
  ] as const)("rejects document %s -> %s", (from, to) => {
    expect(isDocumentTransitionAllowed(from, to)).toBe(false);
    expect(() => assertDocumentTransition(from, to)).toThrow("DOCUMENT_STATE_CONFLICT");
  });

  it.each([
    ["DRAFT", "PENDING_VERIFICATION"], ["DRAFT", "REMOVED"],
    ["PENDING_VERIFICATION", "APPROVED"], ["PENDING_VERIFICATION", "CHANGES_REQUESTED"],
    ["PENDING_VERIFICATION", "REJECTED"], ["PENDING_VERIFICATION", "REMOVED"],
    ["APPROVED", "REPLACEMENT_REQUESTED"], ["APPROVED", "INVALIDATED"],
    ["APPROVED", "SUPERSEDED"], ["APPROVED", "REMOVED"],
    ["CHANGES_REQUESTED", "SUPERSEDED"], ["CHANGES_REQUESTED", "REMOVED"],
    ["REPLACEMENT_REQUESTED", "SUPERSEDED"], ["REPLACEMENT_REQUESTED", "REMOVED"],
  ] as const)("allows payout %s -> %s", (from, to) => {
    expect(isPayoutTransitionAllowed(from, to)).toBe(true);
    expect(() => assertPayoutTransition(from, to)).not.toThrow();
  });

  it.each([
    ["DRAFT", "APPROVED"], ["REJECTED", "DRAFT"], ["INVALIDATED", "APPROVED"],
    ["SUPERSEDED", "APPROVED"], ["REMOVED", "DRAFT"],
  ] as const)("rejects payout %s -> %s", (from, to) => {
    expect(isPayoutTransitionAllowed(from, to)).toBe(false);
    expect(() => assertPayoutTransition(from, to)).toThrow("PAYOUT_DESTINATION_STATE_CONFLICT");
  });
});
