import { assertSafeAuditInput } from "../../../src/modules/admin/audit.service.js";
import { safePayoutHistoryEvent } from "../../../src/modules/providers/provider-payout.dto.js";
import { payoutRevealBody } from "../../../src/modules/providers/provider-payout.schema.js";
import { isMeaningfulSafeNote } from "../../../src/modules/providers/domain/provider-verification.catalog.js";

describe("R1-P06 US8 sensitive projections", () => {
  it("accepts the exact one-version reveal command and rejects extra protected input", () => {
    const command = {
      expectedVersion: 2,
      purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION" as const,
      reason: "Preparing the exact manual beneficiary verification check",
      stepUpProof: "opaque-proof-value-at-least-sixteen",
      commandId: "00000000-0000-4000-8000-000000000008",
    };
    expect(payoutRevealBody.parse(command).purpose).toBe("MANUAL_PAYOUT_DESTINATION_VERIFICATION");
    expect(() => payoutRevealBody.parse({ ...command, fullIdentifier: "+201012345678" })).toThrow();
  });

  it("rejects protected keys from histories and privileged audit payloads", () => {
    expect(() => safePayoutHistoryEvent({ event: "DESTINATION_APPROVED", walletNumber: "+201012345678" })).toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => safePayoutHistoryEvent({ event: "DESTINATION_APPROVED", ciphertext: "private" })).toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => assertSafeAuditInput({
      actorType: "USER",
      actorId: "staff",
      action: "PROVIDER_PAYOUT_REVEAL_ACCEPTED",
      targetType: "PROVIDER_PAYOUT_DESTINATION_VERSION",
      targetId: "destination",
      context: { walletNumber: "+201012345678" },
    })).toThrow();
  });

  it("rejects E.164 and IBAN-like values from persisted human notes", () => {
    expect(isMeaningfulSafeNote("Remove destination +201012345678 after owner request")).toBe(false);
    expect(isMeaningfulSafeNote("Remove destination EG38001900050000000026318002 after owner request")).toBe(false);
    expect(isMeaningfulSafeNote("Remove the unavailable destination after owner request")).toBe(true);
  });
});
