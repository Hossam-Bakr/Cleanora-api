import { safeDocumentHistoryEvent } from "../../../src/modules/providers/provider-verification.dto.js";
import { safePayoutHistoryEvent } from "../../../src/modules/providers/provider-payout.dto.js";

describe("R1-P06 safe document history", () => {
  it("allows safe lifecycle facts and rejects private metadata keys", () => {
    expect(safeDocumentHistoryEvent({ event: "DOCUMENT_APPROVED", exactVersion: 3 })).toEqual({ event: "DOCUMENT_APPROVED", exactVersion: 3 });
    expect(() => safeDocumentHistoryEvent({ event: "DOCUMENT_APPROVED", documentNumber: "private" })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
    expect(() => safeDocumentHistoryEvent({ event: "DOCUMENT_APPROVED", storageKey: "private" })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
  });

  it("allows only masked payout history facts", () => {
    expect(safePayoutHistoryEvent({ event: "DESTINATION_APPROVED", mask: "+20••••••5678", exactVersion: 3 })).toEqual({ event: "DESTINATION_APPROVED", mask: "+20••••••5678", exactVersion: 3 });
    expect(() => safePayoutHistoryEvent({ event: "DESTINATION_APPROVED", holderLegalName: "private" })).toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => safePayoutHistoryEvent({ event: "DESTINATION_APPROVED", fingerprint: "private" })).toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => safePayoutHistoryEvent({ event: "DESTINATION_REMOVED", reasonText: "private command note" })).toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
  });
});
