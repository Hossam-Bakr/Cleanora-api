import { payoutFingerprintIdentity } from "../../../src/modules/providers/domain/payout-destination.policy.js";
import { payoutLookupFingerprints } from "../../../src/modules/providers/infrastructure/payout-data-crypto.adapter.js";
import { r1P06TestKeyRing } from "../../helpers/r1-p06-test-doubles.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("R1-P06 US6 collision and operation identity", () => {
  it("deduplicates wallet identity independently of operator code", () => {
    const first = payoutFingerprintIdentity({ kind: "MOBILE_WALLET", countryCode: "EG", normalizedIdentifier: "+201012345678" });
    const second = payoutFingerprintIdentity({ kind: "MOBILE_WALLET", countryCode: "EG", normalizedIdentifier: "+201012345678" });
    expect(first).toEqual(second);
    expect(first).not.toContain("TEST_OPERATOR_A");
    expect(first).not.toContain("TEST_OPERATOR_B");
  });

  it("generates the same deterministic claim fingerprint for competing commands", () => {
    const rings = r1P06TestKeyRing();
    const input = { kind: "MOBILE_WALLET" as const, countryCode: "EG", normalizedIdentifier: "+201012345678" };
    expect(payoutLookupFingerprints(rings.lookup, input)).toEqual(payoutLookupFingerprints(rings.lookup, input));
  });

  it("domain-separates a wallet from a bank identifier", () => {
    const rings = r1P06TestKeyRing();
    const wallet = payoutLookupFingerprints(rings.lookup, { kind: "MOBILE_WALLET", countryCode: "EG", normalizedIdentifier: "+201012345678" });
    const bank = payoutLookupFingerprints(rings.lookup, { kind: "BANK_ACCOUNT", normalizedIdentifier: "+201012345678" });
    expect(wallet[0]?.fingerprint).not.toBe(bank[0]?.fingerprint);
  });

  it("keeps same-chain claims protected and blocks released same-Provider duplicate chains", () => {
    const source = readFileSync(resolve("src/modules/providers/infrastructure/prisma-provider-payout.repository.ts"), "utf8");
    expect(source).toContain("releaseClaimIfUnused");
    expect(source).toContain("historicalSameProvider");
    expect(source).toContain("historicalSameChain");
    expect(source).toContain("effectiveApprovedVersionId: { not: null }");
    expect(source).not.toContain("await transaction.providerPayoutIdentityClaim.update({ where: { id: row.identityClaimId }, data: { status: \"RELEASED\"");
  });
});
