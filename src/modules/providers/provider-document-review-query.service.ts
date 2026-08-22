import type { ProviderVerificationEvidencePort } from "../media/media.public.js";
import type { PrismaProviderVerificationRepository } from "./infrastructure/prisma-provider-verification.repository.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderDocumentReviewQueryService {
  public constructor(
    private readonly repository: PrismaProviderVerificationRepository,
    private readonly media: ProviderVerificationEvidencePort,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.verification.documents.review") => Promise<boolean>,
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}
  public async listQueue(actorUserId: string, input: { readonly limit?: number; readonly cursor?: string } = {}) {
    if (!(await this.authorizeStaff(actorUserId, "providers.verification.documents.review"))) {
      if (this.denialAudit !== undefined) return this.denialAudit.denyR1P06({ actorUserId, action: "STAFF_VERIFICATION_DOCUMENT_QUEUE_READ", publicErrorCode: "PROVIDER_SCOPE_DENIED" });
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "staff-document-review-queue");
    const rows = await this.repository.listDocumentReviewQueue({ limit: limit + 1, ...(cursor === undefined ? {} : { cursorSubmittedAt: cursor.at, cursorId: cursor.id }) });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last?.submittedAt !== null && last?.submittedAt !== undefined ? encodeR1P06Cursor("staff-document-review-queue", last.submittedAt, last.id) : null };
  }
  public async dossier(input: { readonly actorUserId: string; readonly providerId: string; readonly documentVersionId: string }) {
    if (!(await this.authorizeStaff(input.actorUserId, "providers.verification.documents.review"))) {
      if (this.denialAudit !== undefined) return this.denialAudit.denyR1P06({ actorUserId: input.actorUserId, action: "STAFF_VERIFICATION_DOCUMENT_DOSSIER_READ", targetId: input.providerId, publicErrorCode: "PROVIDER_SCOPE_DENIED" });
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    const document = await this.repository.readDocument(input.providerId, input.documentVersionId);
    if (document === null) throw new Error("DOCUMENT_STATE_CONFLICT");
    const delivery = await Promise.all(document.evidence.map((evidence) => this.media.issuePrivateDelivery({
      mediaFileId: evidence.mediaFileId,
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      purpose: "STAFF_DOCUMENT_REVIEW",
      actorUserId: input.actorUserId,
    })));
    return { document, delivery };
  }
}
