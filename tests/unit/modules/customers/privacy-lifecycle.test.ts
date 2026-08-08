
import {
  canCancelPrivacyRequest,
  isClosedOutcome,
  isTerminalPrivacyStatus,
} from "../../../../src/modules/customers/domain/privacy-request.lifecycle.js";

describe("privacy request lifecycle", () => {
  it("allows customer cancellation only while pending", () => {
    expect(canCancelPrivacyRequest("PENDING")).toBe(true);
    expect(canCancelPrivacyRequest("PROCESSING")).toBe(false);
    expect(canCancelPrivacyRequest("COMPLETED")).toBe(false);
    expect(canCancelPrivacyRequest("REJECTED")).toBe(false);
    expect(canCancelPrivacyRequest("CANCELLED")).toBe(false);
  });

  it("keeps only the DEC-031 terminal outcome pairs", () => {
    expect(isClosedOutcome("COMPLETED", "REQUEST_FULFILLED")).toBe(true);
    expect(isClosedOutcome("REJECTED", "REQUEST_REJECTED")).toBe(true);
    expect(isClosedOutcome("COMPLETED", "REQUEST_REJECTED")).toBe(false);
    expect(isClosedOutcome("REJECTED", "REQUEST_FULFILLED")).toBe(false);
  });

  it("recognizes immutable terminal statuses", () => {
    expect(isTerminalPrivacyStatus("COMPLETED")).toBe(true);
    expect(isTerminalPrivacyStatus("REJECTED")).toBe(true);
    expect(isTerminalPrivacyStatus("CANCELLED")).toBe(true);
    expect(isTerminalPrivacyStatus("PENDING")).toBe(false);
    expect(isTerminalPrivacyStatus("PROCESSING")).toBe(false);
  });
});
