import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

import type {
  EncryptedPayoutField,
  PayoutAadContext,
  PayoutKeyRings,
  PayoutLookupKeyRing,
} from "../domain/provider-verification.types.js";
import { payoutFingerprintIdentity } from "../domain/payout-destination.policy.js";

const AAD_SCHEMA_VERSION = "cleanora.payout-envelope.v1";
const LOOKUP_SCHEMA_VERSION = "cleanora.payout-lookup.v1";

function encodeCanonical(parts: readonly (string | number)[]): Buffer {
  const encoded = parts.map((part) => Buffer.from(String(part), "utf8"));
  const output: Buffer[] = [];
  for (const part of encoded) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(part.length);
    output.push(length, part);
  }
  return Buffer.concat(output);
}

export function buildPayoutAad(context: PayoutAadContext): Buffer {
  return encodeCanonical([
    AAD_SCHEMA_VERSION,
    context.providerId,
    context.destinationChainId,
    context.destinationVersionId,
    context.destinationSequence,
    context.destinationType,
    context.fieldName,
    context.encryptionKeyId,
  ]);
}

export interface PayoutNonceSource {
  next(): Buffer;
}

const secureNonceSource: PayoutNonceSource = { next: () => randomBytes(12) };

export function createPayoutDataCrypto(
  rings: PayoutKeyRings,
  nonceSource: PayoutNonceSource = secureNonceSource,
) {
  return {
    encrypt(plaintext: string, context: PayoutAadContext): EncryptedPayoutField {
      const key = rings.encryption.keys.get(context.encryptionKeyId);
      if (key === undefined || key.length !== 32) throw new Error("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
      const nonce = nonceSource.next();
      if (nonce.length !== 12) throw new Error("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(buildPayoutAad(context));
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return {
        ciphertext: ciphertext.toString("base64url"),
        nonce: nonce.toString("base64url"),
        authenticationTag: cipher.getAuthTag().toString("base64url"),
        encryptionKeyId: context.encryptionKeyId,
      };
    },
    decrypt(envelope: EncryptedPayoutField, context: PayoutAadContext): string {
      const key = rings.encryption.keys.get(envelope.encryptionKeyId);
      if (key === undefined) throw new Error("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
      try {
        const nonce = Buffer.from(envelope.nonce, "base64url");
        const tag = Buffer.from(envelope.authenticationTag, "base64url");
        if (nonce.length !== 12 || tag.length !== 16 || envelope.encryptionKeyId !== context.encryptionKeyId) {
          throw new Error("invalid envelope");
        }
        const decipher = createDecipheriv("aes-256-gcm", key, nonce);
        decipher.setAAD(buildPayoutAad(context));
        decipher.setAuthTag(tag);
        return Buffer.concat([
          decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
          decipher.final(),
        ]).toString("utf8");
      } catch {
        throw new Error("PAYOUT_PROTECTED_VALUE_UNAVAILABLE");
      }
    },
  };
}

export function payoutLookupFingerprints(
  ring: PayoutLookupKeyRing,
  input:
    | { readonly kind: "MOBILE_WALLET"; readonly countryCode: string; readonly normalizedIdentifier: string }
    | { readonly kind: "BANK_ACCOUNT"; readonly normalizedIdentifier: string },
): readonly { readonly lookupKeyId: string; readonly fingerprint: string }[] {
  const canonical = encodeCanonical([
    LOOKUP_SCHEMA_VERSION,
    ...payoutFingerprintIdentity(input),
  ]);
  return [...ring.keys.entries()].map(([lookupKeyId, key]) => ({
    lookupKeyId,
    fingerprint: createHmac("sha256", key).update(canonical).digest("hex"),
  }));
}
