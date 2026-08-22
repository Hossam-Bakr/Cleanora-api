import type {
  PayoutEncryptionKeyRing,
  PayoutKeyRings,
  PayoutLookupKeyRing,
} from "../modules/providers/domain/provider-verification.types.js";

export const PAYOUT_KEY_ENVIRONMENT_NAMES = [
  "PAYOUT_DATA_ENCRYPTION_KEYS_JSON",
  "PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID",
  "PAYOUT_LOOKUP_HMAC_KEYS_JSON",
  "PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID",
] as const;

function unavailable(): never {
  throw new Error("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
}

function decodeStrict(value: unknown): Buffer {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9+/_-]+={0,2}$/u.test(value)) {
    return unavailable();
  }
  const normalized = value.replace(/-/gu, "+").replace(/_/gu, "/").replace(/=+$/u, "");
  const decoded = Buffer.from(value, /[-_]/u.test(value) ? "base64url" : "base64");
  if (decoded.length === 0 || decoded.toString("base64").replace(/=+$/u, "") !== normalized) return unavailable();
  return decoded;
}

function parseRing(
  rawJson: string | undefined,
  activeKeyId: string | undefined,
  exactBytes: number | null,
): { readonly activeKeyId: string; readonly keys: ReadonlyMap<string, Buffer> } {
  if (rawJson === undefined || activeKeyId === undefined || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(activeKeyId)) {
    return unavailable();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(rawJson); } catch { return unavailable(); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
    return unavailable();
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return unavailable();
  const keys = new Map<string, Buffer>();
  for (const [keyId, encoded] of entries) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(keyId)) return unavailable();
    const key = decodeStrict(encoded);
    if ((exactBytes !== null && key.length !== exactBytes) || (exactBytes === null && key.length < 32)) return unavailable();
    keys.set(keyId, key);
  }
  if (!keys.has(activeKeyId)) return unavailable();
  return { activeKeyId, keys };
}

export function parsePayoutKeyRings(environment: Readonly<Record<string, string | undefined>>): PayoutKeyRings {
  const encryption = parseRing(
    environment["PAYOUT_DATA_ENCRYPTION_KEYS_JSON"],
    environment["PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID"],
    32,
  ) as PayoutEncryptionKeyRing;
  const lookup = parseRing(
    environment["PAYOUT_LOOKUP_HMAC_KEYS_JSON"],
    environment["PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID"],
    null,
  ) as PayoutLookupKeyRing;
  const material = new Set<string>();
  for (const key of [...encryption.keys.values(), ...lookup.keys.values()]) {
    const signature = key.toString("base64");
    if (material.has(signature)) return unavailable();
    material.add(signature);
  }
  if (encryption.activeKeyId === lookup.activeKeyId) return unavailable();
  return { encryption, lookup };
}

export function loadPayoutKeyRings(): PayoutKeyRings {
  return parsePayoutKeyRings(process.env);
}

export function assertReferencedPayoutKeysAvailable(input: {
  readonly rings: PayoutKeyRings;
  readonly encryptionKeyIds: readonly string[];
  readonly lookupKeyIds: readonly string[];
}): void {
  if (
    input.encryptionKeyIds.some((keyId) => !input.rings.encryption.keys.has(keyId)) ||
    input.lookupKeyIds.some((keyId) => !input.rings.lookup.keys.has(keyId))
  ) unavailable();
}
