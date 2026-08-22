import { AppError } from "../../../src/shared/errors/app-error.js";
import {
  assertReferencedPayoutKeysAvailable,
  parsePayoutKeyRings,
} from "../../../src/config/payout-data-keys.js";
import {
  assertEvidenceSafety,
  assertEvidenceSet,
  canonicalEvidenceContentType,
  VERIFICATION_EVIDENCE_LIMITS,
} from "../../../src/modules/media/domain/provider-verification-evidence.policy.js";
import {
  decodeR1P06Cursor,
  encodeR1P06Cursor,
} from "../../../src/modules/providers/domain/r1-p06.cursor.js";
import { toR1P06HttpError } from "../../../src/modules/providers/domain/r1-p06.errors.js";
import {
  mapPayoutAdminView,
  mapPayoutOwnerView,
  mapPayoutStaffSafeDossier,
} from "../../../src/modules/providers/provider-payout.dto.js";
import { mapVerificationOverview } from "../../../src/modules/providers/provider-verification.dto.js";

const encoded = (byte: number, length = 32) => Buffer.alloc(length, byte).toString("base64");
const validEnvironment = () => ({
  PAYOUT_DATA_ENCRYPTION_KEYS_JSON: JSON.stringify({ "enc-v1": encoded(0x11) }),
  PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: "enc-v1",
  PAYOUT_LOOKUP_HMAC_KEYS_JSON: JSON.stringify({ "lookup-v1": encoded(0x22) }),
  PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID: "lookup-v1",
});

describe("R1-P06 deterministic security contracts", () => {
  it("round-trips a scoped cursor and rejects every malformed cursor boundary", () => {
    const at = new Date("2026-08-13T09:00:00.000Z");
    const raw = encodeR1P06Cursor("scope-a", at, "row-1");
    expect(decodeR1P06Cursor(undefined, "scope-a")).toBeUndefined();
    expect(decodeR1P06Cursor(raw, "scope-a")).toEqual({ at, id: "row-1" });

    const malformed = [
      "not-json",
      Buffer.from(JSON.stringify({ v: 2, scope: "scope-a", at: at.toISOString(), id: "row-1" })).toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1, scope: "scope-b", at: at.toISOString(), id: "row-1" })).toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1, scope: "scope-a", at: 1, id: "row-1" })).toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1, scope: "scope-a", at: at.toISOString(), id: 1 })).toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1, scope: "scope-a", at: at.toISOString(), id: "" })).toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1, scope: "scope-a", at: "invalid", id: "row-1" })).toString("base64url"),
      Buffer.from(JSON.stringify({ v: 1, scope: "scope-a", at: "2026-08-13", id: "row-1" })).toString("base64url"),
    ];
    for (const candidate of malformed) {
      expect(() => decodeR1P06Cursor(candidate, "scope-a")).toThrow("VALIDATION_ERROR");
    }
  });

  it("maps only declared R1-P06 errors and preserves existing or unknown errors", () => {
    const mapped = toR1P06HttpError(new Error("PAYOUT_REVEAL_RATE_LIMITED"));
    expect(mapped).toMatchObject({ code: "PAYOUT_REVEAL_RATE_LIMITED", statusCode: 429, expose: true });
    const existing = new AppError({ code: "EXISTING", message: "Existing", statusCode: 418 });
    expect(toR1P06HttpError(existing)).toBe(existing);
    const unknown = new Error("UNKNOWN");
    expect(toR1P06HttpError(unknown)).toBe(unknown);
    expect(toR1P06HttpError("not-an-error")).toBe("not-an-error");
  });

  it("fails closed for malformed, short, reused, invalid-id, and missing payout keys", () => {
    const invalidEnvironments = [
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_KEYS_JSON: "{" },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_KEYS_JSON: "[]" },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_KEYS_JSON: "{}" },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: " invalid" },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_KEYS_JSON: JSON.stringify({ "bad key": encoded(0x11) }), PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: "bad key" },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_KEYS_JSON: JSON.stringify({ "enc-v1": "not base64!" }) },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_KEYS_JSON: JSON.stringify({ "enc-v1": encoded(0x11, 31) }) },
      { ...validEnvironment(), PAYOUT_DATA_ENCRYPTION_ACTIVE_KEY_ID: "enc-missing" },
      { ...validEnvironment(), PAYOUT_LOOKUP_HMAC_KEYS_JSON: JSON.stringify({ "lookup-v1": encoded(0x22, 16) }) },
      { ...validEnvironment(), PAYOUT_LOOKUP_HMAC_ACTIVE_KEY_ID: "enc-v1" },
      { ...validEnvironment(), PAYOUT_LOOKUP_HMAC_KEYS_JSON: JSON.stringify({ "lookup-v1": encoded(0x11) }) },
    ];
    for (const environment of invalidEnvironments) {
      expect(() => parsePayoutKeyRings(environment)).toThrow("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
    }

    const rings = parsePayoutKeyRings(validEnvironment());
    expect(() => assertReferencedPayoutKeysAvailable({ rings, encryptionKeyIds: ["enc-v1"], lookupKeyIds: ["lookup-v1"] })).not.toThrow();
    expect(() => assertReferencedPayoutKeysAvailable({ rings, encryptionKeyIds: ["enc-missing"], lookupKeyIds: [] })).toThrow("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
    expect(() => assertReferencedPayoutKeysAvailable({ rings, encryptionKeyIds: [], lookupKeyIds: ["lookup-missing"] })).toThrow("PAYOUT_KEY_CONFIGURATION_UNAVAILABLE");
  });

  it("enforces exact content agreement, safety limits, and homogeneous ordered sets", () => {
    expect(canonicalEvidenceContentType({ extension: ".PNG", declaredContentType: "image/png", detectedContentType: "image/png" })).toBe("image/png");
    expect(canonicalEvidenceContentType({ extension: ".pdf", declaredContentType: "application/pdf", detectedContentType: "application/pdf" })).toBe("application/pdf");
    expect(() => assertEvidenceSafety({ contentType: "image/jpeg", byteSize: 0, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: null })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSafety({ contentType: "image/jpeg", byteSize: VERIFICATION_EVIDENCE_LIMITS.maxImageBytes + 1, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: null })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSafety({ contentType: "application/pdf", byteSize: VERIFICATION_EVIDENCE_LIMITS.maxPdfBytes, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: VERIFICATION_EVIDENCE_LIMITS.maxPdfPages })).not.toThrow();
    expect(() => assertEvidenceSafety({ contentType: "image/png", byteSize: 1, decoded: false, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: null })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
    expect(() => assertEvidenceSafety({ contentType: "application/pdf", byteSize: 1, decoded: true, encryptedPdf: true, activeContent: false, malwareClean: true, pageCount: 1 })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
    expect(() => assertEvidenceSafety({ contentType: "application/pdf", byteSize: 1, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: 0 })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSafety({ contentType: "application/pdf", byteSize: 1, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: VERIFICATION_EVIDENCE_LIMITS.maxPdfPages + 1 })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSafety({ contentType: "application/pdf", byteSize: 1, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: true, pageCount: 1 })).not.toThrow();

    expect(() => assertEvidenceSet({ items: [] })).toThrow("DOCUMENT_EVIDENCE_NOT_READY");
    expect(() => assertEvidenceSet({ items: [{ contentType: "image/jpeg", byteSize: VERIFICATION_EVIDENCE_LIMITS.maxImageBytes + 1, position: 0, pageCount: null }] })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSet({ items: Array.from({ length: 5 }, (_, position) => ({ contentType: "image/jpeg" as const, byteSize: VERIFICATION_EVIDENCE_LIMITS.maxImageBytes, position, pageCount: null })) })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSet({ items: [{ contentType: "application/pdf", byteSize: 1, position: 0, pageCount: 1 }, { contentType: "image/jpeg", byteSize: 1, position: 1, pageCount: null }] })).toThrow("DOCUMENT_EVIDENCE_UNSUPPORTED");
    expect(assertEvidenceSet({ items: [{ contentType: "application/pdf", byteSize: 1, position: 0, pageCount: 1 }] })).toBe("PDF");
    expect(() => assertEvidenceSet({ items: [{ contentType: "application/pdf", byteSize: 1, position: 1, pageCount: 1 }] })).toThrow("DOCUMENT_EVIDENCE_UNSUPPORTED");
    expect(() => assertEvidenceSet({ items: Array.from({ length: 11 }, (_, position) => ({ contentType: "image/jpeg" as const, byteSize: 1, position, pageCount: null })) })).toThrow("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    expect(() => assertEvidenceSet({ items: [{ contentType: "image/png", byteSize: 1, position: 1, pageCount: null }] })).toThrow("DOCUMENT_EVIDENCE_NOT_READY");
    expect(assertEvidenceSet({ items: [{ contentType: "image/png", byteSize: 1, position: 0, pageCount: null }] })).toBe("IMAGE_SET");
  });

  it("projects role-specific payout and verification DTOs without adding protected fields", () => {
    const payout = {
      destinationVersionId: "destination-1", chainId: "chain-1", type: "MOBILE_WALLET" as const,
      mask: "+20••••5678", institution: { code: "OP", label: "Operator" },
      holderRelationship: "PROVIDER_OWNER" as const, status: "APPROVED" as const,
      primary: true, sequence: 1, version: 3, createdAt: "2026-08-13T09:00:00.000Z",
      submittedAt: "2026-08-13T09:01:00.000Z", decidedAt: "2026-08-13T09:02:00.000Z",
    };
    expect(mapPayoutOwnerView({ ...payout, holderLegalName: "Synthetic Owner" })).toMatchObject({ holderLegalName: "Synthetic Owner" });
    expect(mapPayoutAdminView(payout)).not.toHaveProperty("institution");
    expect(mapPayoutAdminView(payout)).not.toHaveProperty("holderRelationship");
    expect(mapPayoutStaffSafeDossier({ ...payout, comparisonSourceAvailable: true, acceptedRevealRequired: true })).toMatchObject({ holderName: undefined, fullIdentifier: undefined });

    expect(mapVerificationOverview({
      providerId: "provider-1", providerKind: "REGISTERED_COMPANY", applicationStatus: "APPROVED",
      operationalStatus: "ACTIVE", payoutDestinationReady: true, capabilities: ["DOCUMENT_READ"],
      truth: { applicable: true, status: "BLOCKED", satisfied: false, blockerCodes: ["DOCUMENT_REQUIREMENT_INCOMPLETE"], badge: "NOT_EARNED" },
    })).toMatchObject({ badgeTruth: "NOT_EARNED", safeBlockerCodes: ["DOCUMENT_REQUIREMENT_INCOMPLETE"] });
  });
});
