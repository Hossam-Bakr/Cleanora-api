import { assertEvidenceSet } from "../../../src/modules/media/domain/provider-verification-evidence.policy.js";
import { assertDocumentPolicyDraft, R1_DOCUMENT_FIELD_RULES } from "../../../src/modules/providers/domain/provider-document-policy.policy.js";
import { assertDocumentMetadataDates } from "../../../src/modules/providers/domain/provider-document-metadata.policy.js";

describe("R1-P06 US2 document submission policy", () => {
  it("accepts one PDF or a contiguous ordered JPEG/PNG set but never a mixed set", () => {
    expect(assertEvidenceSet({ items: [{ contentType: "application/pdf", byteSize: 100, position: 0, pageCount: 2 }] })).toBe("PDF");
    expect(assertEvidenceSet({ items: [
      { contentType: "image/jpeg", byteSize: 100, position: 0, pageCount: null },
      { contentType: "image/png", byteSize: 100, position: 1, pageCount: null },
    ] })).toBe("IMAGE_SET");
    expect(() => assertEvidenceSet({ items: [
      { contentType: "application/pdf", byteSize: 100, position: 0, pageCount: 1 },
      { contentType: "image/jpeg", byteSize: 100, position: 1, pageCount: null },
    ] })).toThrow("DOCUMENT_EVIDENCE_UNSUPPORTED");
  });
  it("requires unique stable document types and positions in a policy", () => {
    expect(() => assertDocumentPolicyDraft({
      countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: new Date(),
      items: [{ documentTypeCode: "TAX_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: R1_DOCUMENT_FIELD_RULES }],
    })).not.toThrow();
    expect(() => assertDocumentPolicyDraft({
      countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: new Date(),
      items: [
        { documentTypeCode: "TAX_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: R1_DOCUMENT_FIELD_RULES },
        { documentTypeCode: "TAX_REGISTRATION", isRequired: true, isActive: true, position: 1, fieldRules: R1_DOCUMENT_FIELD_RULES },
      ],
    })).toThrow("POLICY_VERSION_CONFLICT");
  });

  it("rejects future issue dates and expiry at or before issue", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(() => assertDocumentMetadataDates({ issueDate: new Date("2026-08-13T00:00:00.000Z"), expiresAt: null, now })).not.toThrow();
    expect(() => assertDocumentMetadataDates({ issueDate: new Date("2026-08-14T00:00:00.000Z"), expiresAt: null, now })).toThrow("DOCUMENT_METADATA_INVALID");
    expect(() => assertDocumentMetadataDates({ issueDate: new Date("2026-08-10T00:00:00.000Z"), expiresAt: new Date("2026-08-10T00:00:00.000Z"), now })).toThrow("DOCUMENT_METADATA_INVALID");
    expect(() => assertDocumentMetadataDates({ issueDate: new Date("2026-08-10T00:00:00.000Z"), expiresAt: new Date("2026-08-11T00:00:00.000Z"), now })).not.toThrow();
  });
});
