import { payoutDraftBody, payoutUpdateBody } from "../../../src/modules/providers/provider-payout.schema.js";
import { mapPayoutAdminView, mapPayoutOwnerView } from "../../../src/modules/providers/provider-payout.dto.js";
import { buildBankDraft, buildWalletDraft } from "../../helpers/r1-p06-fixtures.js";

describe("R1-P06 US6 payout draft policy", () => {
  it("accepts only complete registry-coded wallet and bank shapes", () => {
    const wallet = payoutDraftBody.parse(buildWalletDraft());
    const bank = payoutDraftBody.parse(buildBankDraft());
    expect(wallet.type === "MOBILE_WALLET" ? wallet.operatorCode : null).toBe("TEST_OPERATOR");
    expect(bank.type === "BANK_ACCOUNT" ? bank.bankCode : null).toBe("TEST_BANK");
    expect(() => payoutDraftBody.parse({ ...buildWalletDraft(), operator: "free text" })).toThrow();
    expect(() => payoutDraftBody.parse({ ...buildWalletDraft(), phoneVerified: true })).toThrow();
    expect(() => payoutDraftBody.parse({ ...buildWalletDraft(), ownershipEvidenceId: "forbidden" })).toThrow();
    expect(() => payoutDraftBody.parse({ ...buildBankDraft(), accountNumber: "redundant" })).toThrow();
  });

  it("requires complete re-entry for draft update", () => {
    const update = payoutUpdateBody.parse({ ...buildWalletDraft(), expectedVersion: 1 });
    expect(update.type === "MOBILE_WALLET" ? update.walletNumber : "").toMatch(/^\+/u);
    expect(() => payoutUpdateBody.parse({
      type: "MOBILE_WALLET",
      expectedVersion: 1,
      commandId: buildWalletDraft().commandId,
      walletNumber: "+201012345678",
    })).toThrow();
  });

  it("keeps Owner and Admin projections distinct", () => {
    const row = {
      destinationVersionId: "destination",
      chainId: "chain",
      type: "MOBILE_WALLET" as const,
      mask: "+20••••••5678",
      institution: { code: "TEST_OPERATOR", label: "Synthetic Operator" },
      holderRelationship: "PROVIDER_OWNER" as const,
      status: "DRAFT" as const,
      primary: false,
      sequence: 1,
      version: 1,
      createdAt: "2026-08-13T00:00:00.000Z",
      submittedAt: null,
      decidedAt: null,
    };
    expect(mapPayoutOwnerView({ ...row, holderLegalName: "Synthetic Owner" })).toHaveProperty("holderLegalName");
    expect(mapPayoutAdminView(row)).not.toHaveProperty("institution");
    expect(mapPayoutAdminView(row)).not.toHaveProperty("holderRelationship");
  });
});
