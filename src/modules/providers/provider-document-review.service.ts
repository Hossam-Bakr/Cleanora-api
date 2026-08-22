import { assertSafeNoteExcludesProtectedValues, isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";
import type { PrismaProviderVerificationRepository } from "./infrastructure/prisma-provider-verification.repository.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";
import type { ProviderVerificationEvidencePort } from "../media/media.public.js";

export class ProviderDocumentReviewService {
  public constructor(
    private readonly repository: PrismaProviderVerificationRepository,
    private readonly media: ProviderVerificationEvidencePort,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.verification.documents.review") => Promise<boolean>,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}

  public async decide(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly outcome: "APPROVE" | "REJECT" | "REQUEST_REPLACEMENT" | "INVALIDATE";
    readonly reason: string;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    if (!(await this.authorizeStaff(input.actorUserId, "providers.verification.documents.review"))) {
      if (this.denialAudit !== undefined) return this.denialAudit.denyR1P06({ actorUserId: input.actorUserId, action: "STAFF_VERIFICATION_DOCUMENT_DECISION", targetId: input.providerId, requestId: input.requestId, publicErrorCode: "PROVIDER_SCOPE_DENIED" });
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
    const replay = await this.repository.findDocumentDecisionReplay(input);
    if (replay !== null) return replay;
    const now = this.now();
    const document = await this.repository.readDocument(input.providerId, input.documentVersionId);
    if (document === null || document.version !== input.expectedVersion) {
      throw new Error("DOCUMENT_STATE_CONFLICT");
    }
    assertSafeNoteExcludesProtectedValues(input.reason, [
      document.documentNumber,
      document.legalName,
      document.issuerName,
    ]);
    if (input.outcome === "APPROVE") {
      if (
        document.status !== "SUBMITTED" ||
        (document.expiresAt !== null && document.expiresAt <= now) ||
        document.evidence.length === 0
      ) throw new Error("DOCUMENT_STATE_CONFLICT");
      const receipts = await Promise.all(document.evidence.map((evidence) => this.media.readValidationReceipt(evidence.mediaFileId)));
      if (receipts.some((receipt, index) => {
        const evidence = document.evidence[index];
        return receipt?.state !== "READY" ||
          evidence === undefined ||
          receipt.providerId !== input.providerId ||
          receipt.documentVersionId !== input.documentVersionId ||
          receipt.canonicalContentType !== evidence.canonicalContentType ||
          receipt.byteSize !== evidence.byteSize ||
          receipt.pageCount !== evidence.pageCount;
      })) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
    }
    return this.repository.decideDocument({ ...input, now });
  }
}
