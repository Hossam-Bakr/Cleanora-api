import {
  buildPayoutAad,
  createPayoutDataCrypto,
  payoutLookupFingerprints,
} from "../../../src/modules/providers/infrastructure/payout-data-crypto.adapter.js";
import { parsePayoutKeyRings } from "../../../src/config/payout-data-keys.js";
import { R1P06NonceSource } from "../../helpers/r1-p06-test-doubles.js";

const encoded = (byte: number) => Buffer.alloc(32, byte).toString("base64");

describe("R1-P06 payout cryptography", () => {
  const rings = parsePayoutKeyRings({
    PAYOUT_DATA_ENCRYPTION_KEYS_JSON: JSON.stringify({ "enc-v1": encoded(0x11) }),
    PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: "enc-v1",
    PAYOUT_LOOKUP_HMAC_KEYS_JSON: JSON.stringify({ "lookup-v1": encoded(0x22) }),
    PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID: "lookup-v1",
  });
  const context = {
    providerId: "provider-1", destinationChainId: "chain-1",
    destinationVersionId: "version-1", destinationSequence: 1,
    destinationType: "MOBILE_WALLET" as const, fieldName: "IDENTIFIER" as const,
    encryptionKeyId: "enc-v1",
  };

  it("round trips AES-256-GCM and uses a fresh 12-byte nonce", () => {
    const crypto = createPayoutDataCrypto(rings, new R1P06NonceSource());
    const first = crypto.encrypt("+201012345678", context);
    const second = crypto.encrypt("+201012345678", context);
    expect(first.nonce).not.toBe(second.nonce);
    expect(Buffer.from(first.nonce, "base64url")).toHaveLength(12);
    expect(Buffer.from(first.authenticationTag, "base64url")).toHaveLength(16);
    expect(crypto.decrypt(first, context)).toBe("+201012345678");
  });

  it("fails closed on tag, AAD, or key changes", () => {
    const crypto = createPayoutDataCrypto(rings, new R1P06NonceSource());
    const envelope = crypto.encrypt("+201012345678", context);
    expect(() => crypto.decrypt({ ...envelope, authenticationTag: Buffer.alloc(16).toString("base64url") }, context))
      .toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => crypto.decrypt(envelope, { ...context, providerId: "provider-2" }))
      .toThrow("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
    expect(() => crypto.decrypt({ ...envelope, encryptionKeyId: "missing" }, { ...context, encryptionKeyId: "missing" }))
      .toThrow("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
  });

  it("uses canonical AAD and domain-separated deterministic fingerprints", () => {
    expect(buildPayoutAad(context)).toEqual(buildPayoutAad({ ...context }));
    const wallet = payoutLookupFingerprints(rings.lookup, {
      kind: "MOBILE_WALLET", countryCode: "EG", normalizedIdentifier: "+201012345678",
    });
    const bank = payoutLookupFingerprints(rings.lookup, {
      kind: "BANK_ACCOUNT", normalizedIdentifier: "EG42001900050000000026318002",
    });
    expect(wallet).toHaveLength(1);
    expect(wallet[0]?.fingerprint).toHaveLength(64);
    expect(wallet[0]?.fingerprint).not.toBe(bank[0]?.fingerprint);
  });

  it("rejects malformed, short, reused, or missing active keys", () => {
    expect(() => parsePayoutKeyRings({})).toThrow("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
    expect(() => parsePayoutKeyRings({
      PAYOUT_DATA_ENCRYPTION_KEYS_JSON: JSON.stringify({ same: encoded(0x11) }),
      PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: "same",
      PAYOUT_LOOKUP_HMAC_KEYS_JSON: JSON.stringify({ other: encoded(0x11) }),
      PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID: "other",
    })).toThrow("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
  });
});
