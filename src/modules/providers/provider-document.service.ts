import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import {
  assertProviderVerificationEvidenceSet,
  type ProviderVerificationEvidencePort,
} from "../media/media.public.js";
import { canCreateDocumentSuccessor } from "./domain/provider-document-continuity.policy.js";
import { assertDocumentMetadataDates } from "./domain/provider-document-metadata.policy.js";
import type { PrismaProviderVerificationRepository } from "./infrastructure/prisma-provider-verification.repository.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderDocumentService {
  public constructor(
    private readonly repository: PrismaProviderVerificationRepository,
    private readonly media: ProviderVerificationEvidencePort,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}

  private async authorize(principal: AuthenticationPrincipal, providerId: string) {
    const provider = await this.repository.readProviderAccess(providerId, principal.userId);
    if (principal.status !== "ACTIVE" || principal.verificationOnly || provider === null || provider.applicationStatus !== "APPROVED") {
      if (this.denialAudit !== undefined) {
        return this.denialAudit.denyR1P06({
          actorUserId: principal.userId,
          action: "PROVIDER_VERIFICATION_DOCUMENT_ACCESS",
          targetId: providerId,
          publicErrorCode: "PROVIDER_NOT_APPROVED",
        });
      }
      throw new Error("PROVIDER_NOT_APPROVED");
    }
    const member = provider.members[0];
    if (member?.status !== "ACTIVE" || !["OWNER", "ADMIN"].includes(member.level)) {
      if (this.denialAudit !== undefined) {
        return this.denialAudit.denyR1P06({
          actorUserId: principal.userId,
          action: "PROVIDER_VERIFICATION_DOCUMENT_ACCESS",
          targetId: providerId,
          publicErrorCode: "PROVIDER_SCOPE_DENIED",
        });
      }
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    if (provider.kind !== "REGISTERED_COMPANY" || provider.profile?.country === null || provider.profile?.country?.isActive !== true) {
      throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    }
    return provider;
  }

  public async createDraft(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly typeCode: string;
    readonly countryCode: string;
    readonly documentNumber: string;
    readonly legalName: string;
    readonly issuerName: string;
    readonly issueDate: string;
    readonly expiresAt: string | null;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const provider = await this.authorize(input.principal, input.providerId);
    if (provider.profile?.country?.code !== input.countryCode) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    const country = provider.profile.country;
    const now = this.now();
    const policy = await this.repository.readEffectivePolicy({
      countryId: country.id,
      providerKind: "REGISTERED_COMPANY",
      now,
    });
    if (!policy?.items.some((item) => item.documentType.code === input.typeCode)) {
      throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    }
    const issueDate = new Date(`${input.issueDate}T00:00:00.000Z`);
    const expiresAt = input.expiresAt === null ? null : new Date(`${input.expiresAt}T00:00:00.000Z`);
    assertDocumentMetadataDates({ issueDate, expiresAt, now });
    return this.repository.createDraft({
      ...input,
      issueDate,
      expiresAt,
      actorUserId: input.principal.userId,
      now,
    });
  }

  public async updateDraft(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly countryCode: string;
    readonly documentNumber: string;
    readonly legalName: string;
    readonly issuerName: string;
    readonly issueDate: string;
    readonly expiresAt: string | null;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const provider = await this.authorize(input.principal, input.providerId);
    if (provider.profile?.country?.code !== input.countryCode) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    const issueDate = new Date(`${input.issueDate}T00:00:00.000Z`);
    const expiresAt = input.expiresAt === null ? null : new Date(`${input.expiresAt}T00:00:00.000Z`);
    assertDocumentMetadataDates({ issueDate, expiresAt, now: this.now() });
    return this.repository.updateDraft({
      ...input,
      actorUserId: input.principal.userId,
      issueDate,
      expiresAt,
    });
  }

  public async getDetail(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
  }) {
    await this.authorize(input.principal, input.providerId);
    const row = await this.repository.readDocument(input.providerId, input.documentVersionId);
    if (row === null) throw new Error("DOCUMENT_STATE_CONFLICT");
    return row;
  }

  public async reserveEvidence(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly originalExtension: ".pdf" | ".jpg" | ".jpeg" | ".png";
    readonly declaredContentType: string;
    readonly byteSize: number;
    readonly expectedVersion: number;
  }) {
    await this.authorize(input.principal, input.providerId);
    const row = await this.repository.readDocument(input.providerId, input.documentVersionId);
    if (row === null || row.status !== "DRAFT" || row.version !== input.expectedVersion) {
      throw new Error("DOCUMENT_VERSION_CONFLICT");
    }
    return this.media.reserve({
      ownerUserId: input.principal.userId,
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      originalExtension: input.originalExtension,
      declaredContentType: input.declaredContentType,
      byteSize: input.byteSize,
    });
  }

  public async bindReadyEvidence(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly mediaFileId: string;
    readonly position: number;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    await this.authorize(input.principal, input.providerId);
    const receipt = await this.media.readValidationReceipt(input.mediaFileId);
    if (
      receipt?.state !== "READY" ||
      receipt.providerId !== input.providerId ||
      receipt.documentVersionId !== input.documentVersionId
    ) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
    return this.repository.bindEvidence({
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      expectedVersion: input.expectedVersion,
      mediaFileId: input.mediaFileId,
      position: input.position,
      canonicalContentType: receipt.canonicalContentType,
      byteSize: receipt.byteSize,
      pageCount: receipt.pageCount,
      actorUserId: input.principal.userId,
      commandId: input.commandId,
      requestId: input.requestId,
    });
  }

  public async ingestEvidence(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly originalExtension: ".pdf" | ".jpg" | ".jpeg" | ".png";
    readonly declaredContentType: string;
    readonly bytes: Buffer;
    readonly position: number;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    await this.authorize(input.principal, input.providerId);
    const row = await this.repository.readDocument(input.providerId, input.documentVersionId);
    if (row === null || row.status !== "DRAFT" || row.version !== input.expectedVersion) {
      throw new Error("DOCUMENT_VERSION_CONFLICT");
    }
    const receipt = await this.media.ingest({
      ownerUserId: input.principal.userId,
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      originalExtension: input.originalExtension,
      declaredContentType: input.declaredContentType,
      bytes: input.bytes,
    });
    if (
      receipt.state !== "READY" ||
      receipt.providerId !== input.providerId ||
      receipt.documentVersionId !== input.documentVersionId
    ) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
    try {
      const document = await this.repository.bindEvidence({
        providerId: input.providerId,
        documentVersionId: input.documentVersionId,
        expectedVersion: input.expectedVersion,
        mediaFileId: receipt.mediaFileId,
        position: input.position,
        canonicalContentType: receipt.canonicalContentType,
        byteSize: receipt.byteSize,
        pageCount: receipt.pageCount,
        actorUserId: input.principal.userId,
        commandId: input.commandId,
        requestId: input.requestId,
      });
      return { receipt, document };
    } catch (error) {
      await this.media.requestCleanup({
        mediaFileId: receipt.mediaFileId,
        safeReasonCode: "PROVIDER_DOCUMENT_BIND_FAILED",
      });
      throw error;
    }
  }

  public async removeEvidence(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly evidenceId: string;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    await this.authorize(input.principal, input.providerId);
    const removed = await this.repository.removeEvidence({
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      evidenceId: input.evidenceId,
      expectedVersion: input.expectedVersion,
      actorUserId: input.principal.userId,
      commandId: input.commandId,
      requestId: input.requestId,
    });
    await this.media.requestCleanup({
      mediaFileId: removed.mediaFileId,
      safeReasonCode: "PROVIDER_DOCUMENT_EVIDENCE_REMOVED",
    });
    return removed;
  }

  public async reorderEvidence(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly evidenceIds: readonly string[];
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    await this.authorize(input.principal, input.providerId);
    return this.repository.reorderEvidence({
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      evidenceIds: input.evidenceIds,
      expectedVersion: input.expectedVersion,
      actorUserId: input.principal.userId,
      commandId: input.commandId,
      requestId: input.requestId,
    });
  }

  public async submit(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const provider = await this.authorize(input.principal, input.providerId);
    const replay = await this.repository.findDocumentSubmitReplay({
      providerId: input.providerId,
      documentVersionId: input.documentVersionId,
      expectedVersion: input.expectedVersion,
      actorUserId: input.principal.userId,
      commandId: input.commandId,
      requestId: input.requestId,
    });
    if (replay !== null) return replay;
    const row = await this.repository.readDocument(input.providerId, input.documentVersionId);
    if (row === null || row.version !== input.expectedVersion) throw new Error("DOCUMENT_VERSION_CONFLICT");
    assertDocumentMetadataDates({ issueDate: row.issueDate, expiresAt: row.expiresAt, now: this.now() });
    const receipts = await Promise.all(row.evidence.map((evidence) => this.media.readValidationReceipt(evidence.mediaFileId)));
    if (receipts.some((receipt) =>
      receipt?.state !== "READY" ||
      receipt.providerId !== input.providerId ||
      receipt.documentVersionId !== input.documentVersionId
    )) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
    const evidenceFormat = assertProviderVerificationEvidenceSet({
      items: row.evidence.map((evidence) => ({
        contentType: evidence.canonicalContentType as "application/pdf" | "image/jpeg" | "image/png",
        byteSize: evidence.byteSize,
        position: evidence.position,
        pageCount: evidence.pageCount,
      })),
    });
    const country = provider.profile?.country;
    if (country === null || country === undefined) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    const policy = await this.repository.readEffectivePolicy({ countryId: country.id, providerKind: "REGISTERED_COMPANY", now: this.now() });
    const item = policy?.items.find((candidate) => candidate.documentType.code === row.chain.documentType.code && candidate.isRequired);
    if (policy === null || item === undefined) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    return this.repository.submitDocument({
      ...input,
      actorUserId: input.principal.userId,
      policyVersionId: policy.id,
      policyItemId: item.id,
      policyRuleSnapshot: item.fieldRules as object,
      evidenceFormat,
      now: this.now(),
    });
  }

  public async createSuccessor(input: {
    readonly principal: AuthenticationPrincipal;
    readonly providerId: string;
    readonly predecessorVersionId: string;
    readonly expectedVersion: number;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    await this.authorize(input.principal, input.providerId);
    const predecessor = await this.repository.readDocument(input.providerId, input.predecessorVersionId);
    if (predecessor === null || !canCreateDocumentSuccessor(predecessor.status)) throw new Error("DOCUMENT_STATE_CONFLICT");
    return this.repository.createSuccessor({ ...input, actorUserId: input.principal.userId });
  }
}
