import {
  buildIbanMask,
  buildWalletMask,
  normalizeIban,
  normalizeWalletE164,
} from "../../../src/modules/providers/domain/payout-destination.policy.js";

describe("R1-P06 payout normalization and exact masks", () => {
  it("normalizes a wallet without inferring its operator", () => {
    expect(normalizeWalletE164(" +20 101-234-5678 ", ["20"])).toBe("+201012345678");
    expect(() => normalizeWalletE164("+971501234567", ["20"])).toThrow("PAYOUT_IDENTIFIER_INVALID");
    expect(() => normalizeWalletE164("01012345678", ["20"])).toThrow("PAYOUT_IDENTIFIER_INVALID");
  });

  it("builds the locked wallet mask", () => {
    expect(buildWalletMask("+201012345678", ["20"])).toEqual({
      callingCode: "20",
      lastFour: "5678",
      nationalLength: 10,
      mask: "+20••••••5678",
    });
  });

  it("normalizes and validates IBAN checksum", () => {
    expect(normalizeIban("eg42 0019 0005 0000 0000 2631 8002", "EG")).toBe(
      "EG42001900050000000026318002",
    );
    expect(() => normalizeIban("EG38001900050000000026318003", "EG")).toThrow(
      "PAYOUT_IDENTIFIER_INVALID",
    );
    expect(() => normalizeIban("GB82WEST12345698765432", "EG")).toThrow(
      "PAYOUT_IDENTIFIER_INVALID",
    );
  });

  it("builds the locked grouped IBAN mask", () => {
    expect(buildIbanMask("EG42001900050000000026318002")).toEqual({
      ibanCountryPrefix: "EG",
      lastFour: "8002",
      normalizedLength: 28,
      mask: "EG•• •••• •••• •••• •••• •••• 8002",
    });
  });
});
