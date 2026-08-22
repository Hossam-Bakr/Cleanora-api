export const VERIFICATION_EVIDENCE_LIMITS = {
  maxPdfBytes: 15 * 1024 * 1024,
  maxImageBytes: 5 * 1024 * 1024,
  maxImageCount: 10,
  maxPdfPages: 10,
  maxImageAggregateBytes: 20 * 1024 * 1024,
} as const;

export type VerificationEvidenceContentType = "application/pdf" | "image/jpeg" | "image/png";

export function canonicalEvidenceContentType(input: {
  readonly extension: string;
  readonly declaredContentType: string;
  readonly detectedContentType: string;
}): VerificationEvidenceContentType {
  const extension = input.extension.toLowerCase();
  if (
    [".jpg", ".jpeg"].includes(extension) &&
    input.declaredContentType === "image/jpeg" &&
    input.detectedContentType === "image/jpeg"
  ) return "image/jpeg";
  if (extension === ".png" && input.declaredContentType === "image/png" && input.detectedContentType === "image/png") {
    return "image/png";
  }
  if (extension === ".pdf" && input.declaredContentType === "application/pdf" && input.detectedContentType === "application/pdf") {
    return "application/pdf";
  }
  throw new Error("DOCUMENT_EVIDENCE_UNSUPPORTED");
}

export function assertEvidenceSafety(input: {
  readonly contentType: VerificationEvidenceContentType;
  readonly byteSize: number;
  readonly decoded: boolean;
  readonly encryptedPdf: boolean;
  readonly activeContent: boolean;
  readonly malwareClean: boolean;
  readonly pageCount: number | null;
}): void {
  const maxBytes = input.contentType === "application/pdf"
    ? VERIFICATION_EVIDENCE_LIMITS.maxPdfBytes
    : VERIFICATION_EVIDENCE_LIMITS.maxImageBytes;
  if (input.byteSize <= 0 || input.byteSize > maxBytes) {
    throw new Error("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
  }
  if (!input.decoded || input.encryptedPdf || input.activeContent || !input.malwareClean) {
    throw new Error("DOCUMENT_EVIDENCE_UNSAFE");
  }
  if (input.pageCount !== null && (input.pageCount <= 0 || input.pageCount > VERIFICATION_EVIDENCE_LIMITS.maxPdfPages)) {
    throw new Error("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
  }
}

export function assertEvidenceSet(input: {
  readonly items: readonly { readonly contentType: VerificationEvidenceContentType; readonly byteSize: number; readonly position: number; readonly pageCount: number | null }[];
}): "PDF" | "IMAGE_SET" {
  if (input.items.length === 0) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
  const types = new Set(input.items.map((item) => item.contentType === "application/pdf" ? "PDF" : "IMAGE"));
  if (types.size !== 1) throw new Error("DOCUMENT_EVIDENCE_UNSUPPORTED");
  if (types.has("PDF")) {
    const pdf = input.items[0];
    if (input.items.length !== 1 || pdf?.position !== 0) throw new Error("DOCUMENT_EVIDENCE_UNSUPPORTED");
    if (
      pdf.byteSize <= 0 ||
      pdf.byteSize > VERIFICATION_EVIDENCE_LIMITS.maxPdfBytes ||
      pdf.pageCount === null ||
      pdf.pageCount <= 0 ||
      pdf.pageCount > VERIFICATION_EVIDENCE_LIMITS.maxPdfPages
    ) throw new Error("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
    return "PDF";
  }
  if (input.items.length > VERIFICATION_EVIDENCE_LIMITS.maxImageCount) throw new Error("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
  if (input.items.some((item) => item.byteSize <= 0 || item.byteSize > VERIFICATION_EVIDENCE_LIMITS.maxImageBytes)) {
    throw new Error("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
  }
  const aggregateBytes = input.items.reduce((sum, item) => sum + item.byteSize, 0);
  if (aggregateBytes > VERIFICATION_EVIDENCE_LIMITS.maxImageAggregateBytes) {
    throw new Error("DOCUMENT_EVIDENCE_LIMIT_EXCEEDED");
  }
  const positions = input.items.map((item) => item.position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index)) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
  return "IMAGE_SET";
}
