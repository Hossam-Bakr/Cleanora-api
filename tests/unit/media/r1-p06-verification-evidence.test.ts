import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  assertEvidenceSafety,
  canonicalEvidenceContentType,
} from "../../../src/modules/media/domain/provider-verification-evidence.policy.js";
import { inspectVerificationEvidence } from "../../../src/modules/media/infrastructure/provider-verification-evidence.adapter.js";

describe("R1-P06 verification evidence", () => {
  it.each([".jpg", ".jpeg"])("canonicalizes %s as image/jpeg after actual decode", async (extension) => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).jpeg().toBuffer();
    const result = await inspectVerificationEvidence({
      buffer: bytes, extension, declaredContentType: "image/jpeg",
      scanner: { async scan() { return { clean: true, safeCode: "CLEAN" }; } },
    });
    expect(result.canonicalContentType).toBe("image/jpeg");
    expect(result.normalized.length).toBeGreaterThan(0);
  });
  it("rejects extension/signature mismatch, active PDF, malware, and unsafe limits", () => {
    expect(() => canonicalEvidenceContentType({ extension: ".jpg", declaredContentType: "image/jpeg", detectedContentType: "image/png" })).toThrow("DOCUMENT_EVIDENCE_UNSUPPORTED");
    expect(() => assertEvidenceSafety({ contentType: "application/pdf", byteSize: 100, decoded: true, encryptedPdf: false, activeContent: true, malwareClean: true, pageCount: 1 })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
    expect(() => assertEvidenceSafety({ contentType: "image/jpeg", byteSize: 100, decoded: true, encryptedPdf: false, activeContent: false, malwareClean: false, pageCount: null })).toThrow("DOCUMENT_EVIDENCE_UNSAFE");
  });

  it("structurally decodes a valid PDF and derives the exact page count", async () => {
    const document = await PDFDocument.create();
    document.addPage();
    document.addPage();
    const bytes = Buffer.from(await document.save());
    const result = await inspectVerificationEvidence({
      buffer: bytes,
      extension: ".pdf",
      declaredContentType: "application/pdf",
      scanner: { async scan() { return { clean: true, safeCode: "CLEAN" }; } },
    });
    expect(result).toMatchObject({ canonicalContentType: "application/pdf", pageCount: 2 });
  });

  it.each(["OpenAction", "AA", "RichMedia", "XFA", "SubmitForm", "ImportData"])(
    "rejects PDF active-content marker /%s",
    async (marker) => {
      const unsafe = Buffer.from(`%PDF-1.7\n/Type /Catalog\n/${marker} 1 0 R\n%%EOF`, "latin1");
      await expect(inspectVerificationEvidence({
        buffer: unsafe,
        extension: ".pdf",
        declaredContentType: "application/pdf",
        scanner: { async scan() { return { clean: true, safeCode: "CLEAN" }; } },
      })).rejects.toThrow("DOCUMENT_EVIDENCE_UNSAFE");
    },
  );

  it("rejects a malformed PDF even when its signature and MIME agree", async () => {
    await expect(inspectVerificationEvidence({
      buffer: Buffer.from("%PDF-not-a-structural-document", "latin1"),
      extension: ".pdf",
      declaredContentType: "application/pdf",
      scanner: { async scan() { return { clean: true, safeCode: "CLEAN" }; } },
    })).rejects.toThrow("DOCUMENT_EVIDENCE_UNSAFE");
  });
});
