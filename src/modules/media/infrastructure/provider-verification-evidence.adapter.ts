import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

import type { ProviderVerificationEvidencePort, ProviderVerificationEvidenceReceipt } from "../media.public.js";
import {
  assertEvidenceSafety,
  canonicalEvidenceContentType,
} from "../domain/provider-verification-evidence.policy.js";

export interface VerificationMalwareScanner {
  scan(buffer: Buffer): Promise<{ readonly clean: boolean; readonly safeCode: string }>;
}

export interface PrivateEvidenceStorage {
  store(input: { readonly mediaFileId: string; readonly buffer: Buffer; readonly contentType: string }): Promise<void>;
  issuePrivateDelivery(input: { readonly mediaFileId: string; readonly expiresInSeconds: number }): Promise<{ readonly url: string; readonly expiresAt: Date }>;
}

export async function inspectVerificationEvidence(input: {
  readonly buffer: Buffer;
  readonly extension: string;
  readonly declaredContentType: string;
  readonly scanner: VerificationMalwareScanner;
}): Promise<{ readonly canonicalContentType: "application/pdf" | "image/jpeg" | "image/png"; readonly normalized: Buffer; readonly pageCount: number | null }> {
  let detected: string;
  let normalized = input.buffer;
  let decoded = false;
  let pageCount: number | null = null;
  let encryptedPdf = false;
  let activeContent = false;
  if (input.buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    detected = "application/pdf";
    const text = input.buffer.toString("latin1");
    encryptedPdf = /\/Encrypt\b/u.test(text);
    activeContent = /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA|SubmitForm|ImportData)\b/u.test(text);
    if (!encryptedPdf && !activeContent) {
      try {
        const document = await PDFDocument.load(input.buffer, {
          ignoreEncryption: false,
          updateMetadata: false,
          throwOnInvalidObject: true,
        });
        pageCount = document.getPageCount();
        decoded = pageCount > 0;
      } catch {
        decoded = false;
      }
    }
  } else {
    const metadata = await sharp(input.buffer, { failOn: "error" }).metadata();
    detected = metadata.format === "jpeg" ? "image/jpeg" : metadata.format === "png" ? "image/png" : "unsupported";
    normalized = await sharp(input.buffer).rotate().toFormat(metadata.format === "png" ? "png" : "jpeg").withMetadata({}).toBuffer();
    decoded = true;
  }
  const canonicalContentType = canonicalEvidenceContentType({
    extension: input.extension,
    declaredContentType: input.declaredContentType,
    detectedContentType: detected,
  });
  // Scan the received bytes, not only an image-normalized derivative that may
  // have discarded an appended payload before malware inspection.
  const scan = await input.scanner.scan(input.buffer);
  assertEvidenceSafety({
    contentType: canonicalContentType,
    byteSize: input.buffer.length,
    decoded,
    encryptedPdf,
    activeContent,
    malwareClean: scan.clean,
    pageCount,
  });
  return { canonicalContentType, normalized, pageCount };
}

/** Composition-owned adapter; persistence callbacks keep Media ownership explicit. */
export class ProviderVerificationEvidenceAdapter implements ProviderVerificationEvidencePort {
  public constructor(
    private readonly callbacks: {
      readonly reserve: ProviderVerificationEvidencePort["reserve"];
      readonly ingest: ProviderVerificationEvidencePort["ingest"];
      readonly readValidationReceipt: (mediaFileId: string) => Promise<ProviderVerificationEvidenceReceipt | null>;
      readonly issuePrivateDelivery: ProviderVerificationEvidencePort["issuePrivateDelivery"];
      readonly requestCleanup: ProviderVerificationEvidencePort["requestCleanup"];
    },
  ) {}
  public reserve(input: Parameters<ProviderVerificationEvidencePort["reserve"]>[0]) {
    return this.callbacks.reserve(input);
  }
  public ingest(input: Parameters<ProviderVerificationEvidencePort["ingest"]>[0]) {
    return this.callbacks.ingest(input);
  }
  public readValidationReceipt(mediaFileId: string) {
    return this.callbacks.readValidationReceipt(mediaFileId);
  }
  public issuePrivateDelivery(input: Parameters<ProviderVerificationEvidencePort["issuePrivateDelivery"]>[0]) {
    return this.callbacks.issuePrivateDelivery(input);
  }
  public requestCleanup(input: Parameters<ProviderVerificationEvidencePort["requestCleanup"]>[0]) {
    return this.callbacks.requestCleanup(input);
  }
}
