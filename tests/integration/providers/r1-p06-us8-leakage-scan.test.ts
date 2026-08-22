import { mapPayoutAdminView, mapPayoutStaffSafeDossier, safePayoutHistoryEvent } from "../../../src/modules/providers/provider-payout.dto.js";
import { safeDocumentHistoryEvent } from "../../../src/modules/providers/provider-verification.dto.js";
import { R1_P06_SENTINELS } from "../../helpers/r1-p06-fixtures.js";

describe("R1-P06 forbidden-sentinel projection scan", () => {
  const safe = {
    destinationVersionId: "destination-1", chainId: "chain-1", type: "MOBILE_WALLET" as const,
    mask: "+20••••••5678", institution: { code: "TEST", label: "Synthetic" },
    holderRelationship: "PROVIDER_OWNER" as const, status: "PENDING_VERIFICATION" as const,
    primary: false, sequence: 1, version: 2, createdAt: "2026-08-13T09:00:00.000Z",
    submittedAt: "2026-08-13T09:01:00.000Z", decidedAt: null,
  };

  it("keeps plaintext sentinels out of ordinary Admin, Staff, history, audit-shaped, and error payloads", () => {
    const surfaces = [
      mapPayoutAdminView(safe),
      mapPayoutStaffSafeDossier({ ...safe, comparisonSourceAvailable: true, acceptedRevealRequired: true }),
      safePayoutHistoryEvent({ event: "DESTINATION_SUBMITTED", mask: safe.mask, exactVersion: 2 }),
      safeDocumentHistoryEvent({ event: "DOCUMENT_SUBMITTED", exactVersion: 2 }),
      { success: false, error: { code: "PAYOUT_DESTINATION_STATE_CONFLICT", statusCode: 409 }, requestId: "request-1" },
      { action: "PROVIDER_PAYOUT_REVEAL_ACCEPTED", context: { encryptionKeyIds: ["enc-v1"], lookupKeyIds: ["lookup-v1"] } },
    ];
    const serialized = JSON.stringify(surfaces);
    for (const sentinel of [R1_P06_SENTINELS.wallet, R1_P06_SENTINELS.iban, R1_P06_SENTINELS.holderName, R1_P06_SENTINELS.documentNumber, R1_P06_SENTINELS.encryptionKey, R1_P06_SENTINELS.lookupKey]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("rejects forbidden history fields rather than silently redacting them", () => {
    expect(() => safePayoutHistoryEvent({ walletNumber: R1_P06_SENTINELS.wallet })).toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => safeDocumentHistoryEvent({ documentNumber: R1_P06_SENTINELS.documentNumber })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
  });
});
