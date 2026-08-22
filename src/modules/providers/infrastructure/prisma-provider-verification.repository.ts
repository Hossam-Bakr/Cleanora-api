import { createHash } from "node:crypto";

import { getPrismaClient } from "#database/prisma";
import { Prisma } from "#generated/prisma/client";
import type { ProviderDocumentVersion, VerificationDocumentPolicyVersion } from "#generated/prisma/client";
import type { PrivilegedAuditWriter } from "../../admin/audit.public.js";
import type { R1P06StaffPermissionCode, TransactionalStaffPermissionAuthorizerFactory } from "../../authentication/authentication.public.js";
import type { TransactionalProviderVerificationEvidenceAuthorizerFactory } from "../../media/media.public.js";
import { assertSafeNoteExcludesProtectedValues, isMeaningfulSafeNote } from "../domain/provider-verification.catalog.js";
import { deriveDocumentVerificationTruth } from "../domain/provider-verification.policy.js";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function samePolicyItems(
  existing: readonly {
    readonly documentType: { readonly code: string };
    readonly isRequired: boolean;
    readonly isActive: boolean;
    readonly position: number;
    readonly fieldRules: unknown;
  }[],
  expected: readonly {
    readonly documentTypeCode: string;
    readonly isRequired: boolean;
    readonly isActive: boolean;
    readonly position: number;
    readonly fieldRules: unknown;
  }[],
): boolean {
  if (existing.length !== expected.length) return false;
  const sortedExisting = [...existing].sort((left, right) => left.position - right.position);
  const sortedExpected = [...expected].sort((left, right) => left.position - right.position);
  return sortedExpected.every((item, index) => {
    const stored = sortedExisting[index];
    return stored !== undefined &&
      stored.documentType.code === item.documentTypeCode &&
      stored.isRequired === item.isRequired &&
      stored.isActive === item.isActive &&
      stored.position === item.position &&
      canonicalJson(stored.fieldRules) === canonicalJson(item.fieldRules);
  });
}

function documentMutationFingerprint(parts: readonly unknown[]): string {
  return createHash("sha256").update(canonicalJson(parts), "utf8").digest("hex");
}

export class PrismaProviderVerificationRepository {
  public constructor(
    private readonly db = getPrismaClient(),
    private readonly createAuditWriter?: (transaction: Prisma.TransactionClient) => PrivilegedAuditWriter,
    private readonly createStaffPermissionAuthorizer?: TransactionalStaffPermissionAuthorizerFactory,
    private readonly createEvidenceAuthorizer?: TransactionalProviderVerificationEvidenceAuthorizerFactory,
  ) {}

  private async assertStaffPermission(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    permission: R1P06StaffPermissionCode,
  ): Promise<void> {
    const authorizer = this.createStaffPermissionAuthorizer?.(transaction);
    if (authorizer === undefined || !(await authorizer.authorize(actorUserId, permission))) {
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
  }

  private async assertDocumentMutationAuthority(
    transaction: Prisma.TransactionClient,
    input: { readonly providerId: string; readonly actorUserId: string; readonly countryCode?: string },
  ) {
    const provider = await transaction.provider.findFirst({
      where: {
        id: input.providerId,
        kind: "REGISTERED_COMPANY",
        applicationStatus: "APPROVED",
        members: {
          some: { userId: input.actorUserId, status: "ACTIVE", level: { in: ["OWNER", "ADMIN"] } },
        },
        profile: {
          country: {
            isActive: true,
            ...(input.countryCode === undefined ? {} : { code: input.countryCode }),
          },
        },
      },
      select: { id: true, profile: { select: { countryId: true } } },
    });
    if (provider?.profile?.countryId === undefined || provider.profile.countryId === null) {
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    return { countryId: provider.profile.countryId };
  }

  public async readProviderAccess(providerId: string, actorUserId: string) {
    return this.db.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        kind: true,
        applicationStatus: true,
        operationalStatus: true,
        applicationOwnerUserId: true,
        ownerUserId: true,
        profile: { select: { country: { select: { id: true, code: true, isActive: true } } } },
        members: {
          where: { userId: actorUserId },
          select: { userId: true, level: true, status: true },
        },
      },
    });
  }

  public async readEffectivePolicy(input: {
    readonly countryId: string;
    readonly providerKind: "REGISTERED_COMPANY";
    readonly now: Date;
  }) {
    return this.db.verificationDocumentPolicyVersion.findFirst({
      where: {
        countryId: input.countryId,
        providerKind: input.providerKind,
        status: "PUBLISHED",
        effectiveAt: { lte: input.now },
      },
      orderBy: [{ policyVersion: "desc" }, { id: "desc" }],
      include: {
        items: {
          where: { isActive: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
          include: { documentType: true },
        },
      },
    });
  }

  public async listEffectiveDocumentTypeCodes(providerId: string, now: Date): Promise<readonly string[]> {
    const rows = await this.db.providerDocumentChain.findMany({
      where: {
        providerId,
        effectiveVersion: {
          status: "APPROVED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      select: { documentType: { select: { code: true } } },
    });
    return rows.map((row) => row.documentType.code);
  }

  public async createDraft(input: {
    readonly providerId: string;
    readonly typeCode: string;
    readonly countryCode: string;
    readonly documentNumber: string;
    readonly legalName: string;
    readonly issuerName: string;
    readonly issueDate: Date;
    readonly expiresAt: Date | null;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
    readonly now: Date;
  }): Promise<ProviderDocumentVersion> {
    const existing = await this.db.providerDocumentVersion.findUnique({
      where: { idempotencyKey: input.commandId },
      include: { chain: { include: { documentType: true } } },
    });
    if (existing !== null) {
      const prior = await this.db.providerVerificationHistory.findUnique({
        where: { operationKey: `document-draft:${input.commandId}` },
      });
      if (
        prior === null ||
        prior.event !== "DOCUMENT_DRAFT_CREATED" ||
        prior.documentVersionId !== existing.id ||
        prior.providerId !== input.providerId ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId ||
        prior.exactVersion !== 1 ||
        existing.providerId !== input.providerId ||
        existing.status !== "DRAFT" ||
        existing.version !== 1 ||
        existing.chain.documentType.code !== input.typeCode ||
        existing.countryCode !== input.countryCode ||
        existing.documentNumber !== input.documentNumber ||
        existing.legalName !== input.legalName ||
        existing.issuerName !== input.issuerName ||
        existing.issueDate.getTime() !== input.issueDate.getTime() ||
        existing.expiresAt?.getTime() !== input.expiresAt?.getTime() ||
        existing.createdByUserId !== input.actorUserId
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return existing;
    }
    try {
      return await this.db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
        const authority = await this.assertDocumentMutationAuthority(transaction, input);
        const type = await transaction.verificationDocumentType.findFirst({
        where: { code: input.typeCode, isActive: true },
      });
      if (type === null) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
      const policy = await transaction.verificationDocumentPolicyVersion.findFirst({
        where: {
          countryId: authority.countryId,
          providerKind: "REGISTERED_COMPANY",
          status: "PUBLISHED",
          effectiveAt: { lte: input.now },
          items: { some: { documentTypeId: type.id, isActive: true } },
        },
        orderBy: [{ policyVersion: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      if (policy === null) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
      const chain = await transaction.providerDocumentChain.upsert({
        where: { providerId_documentTypeId: { providerId: input.providerId, documentTypeId: type.id } },
        create: { providerId: input.providerId, documentTypeId: type.id },
        update: {},
      });
      const latest = await transaction.providerDocumentVersion.findFirst({
        where: { chainId: chain.id }, orderBy: { sequence: "desc" }, select: { sequence: true },
      });
      if (latest !== null) throw new Error("DOCUMENT_STATE_CONFLICT");
      const version = await transaction.providerDocumentVersion.create({
        data: {
          chainId: chain.id,
          providerId: input.providerId,
          sequence: 1,
          countryCode: input.countryCode,
          documentNumber: input.documentNumber,
          legalName: input.legalName,
          issuerName: input.issuerName,
          issueDate: input.issueDate,
          expiresAt: input.expiresAt,
          createdByUserId: input.actorUserId,
          idempotencyKey: input.commandId,
        },
      });
      await transaction.providerVerificationHistory.create({
        data: {
          providerId: input.providerId,
          documentVersionId: version.id,
          event: "DOCUMENT_DRAFT_CREATED",
          toStatus: "DRAFT",
          actorType: "USER",
          actorUserId: input.actorUserId,
          exactVersion: version.version,
          requestId: input.requestId,
          operationKey: `document-draft:${input.commandId}`,
        },
      });
        return version;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.createDraft(input);
      }
      throw error;
    }
  }

  public async updateDraft(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly countryCode: string;
    readonly documentNumber: string;
    readonly legalName: string;
    readonly issuerName: string;
    readonly issueDate: Date;
    readonly expiresAt: Date | null;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const operationKey = `document-draft-update:${input.documentVersionId}:${input.commandId}`;
    const prior = await this.db.providerVerificationHistory.findUnique({ where: { operationKey } });
    if (prior !== null) {
      const current = await this.db.providerDocumentVersion.findUniqueOrThrow({ where: { id: input.documentVersionId } });
      if (
        prior.providerId !== input.providerId ||
        prior.documentVersionId !== input.documentVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId ||
        current.status !== "DRAFT" ||
        current.version !== input.expectedVersion + 1 ||
        current.countryCode !== input.countryCode ||
        current.documentNumber !== input.documentNumber ||
        current.legalName !== input.legalName ||
        current.issuerName !== input.issuerName ||
        current.issueDate.getTime() !== input.issueDate.getTime() ||
        current.expiresAt?.getTime() !== input.expiresAt?.getTime()
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return current;
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.documentVersionId} FOR UPDATE`;
      await this.assertDocumentMutationAuthority(transaction, input);
      const changed = await transaction.providerDocumentVersion.updateMany({
        where: {
          id: input.documentVersionId,
          providerId: input.providerId,
          status: "DRAFT",
          version: input.expectedVersion,
        },
        data: {
          countryCode: input.countryCode,
          documentNumber: input.documentNumber,
          legalName: input.legalName,
          issuerName: input.issuerName,
          issueDate: input.issueDate,
          expiresAt: input.expiresAt,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
      const row = await transaction.providerDocumentVersion.findUniqueOrThrow({
        where: { id: input.documentVersionId },
      });
      await transaction.providerVerificationHistory.create({
        data: {
          providerId: input.providerId,
          documentVersionId: row.id,
          event: "DOCUMENT_DRAFT_UPDATED",
          toStatus: "DRAFT",
          actorType: "USER",
          actorUserId: input.actorUserId,
          exactVersion: input.expectedVersion,
          requestId: input.requestId,
          operationKey,
        },
      });
      return row;
    });
  }

  public async readDocument(providerId: string, documentVersionId: string) {
    return this.db.providerDocumentVersion.findFirst({
      where: { id: documentVersionId, providerId },
      include: {
        chain: { include: { documentType: true } },
        evidence: { orderBy: [{ position: "asc" }, { id: "asc" }] },
        successor: { select: { id: true } },
      },
    });
  }

  public async listDocuments(input: { readonly providerId: string; readonly limit: number; readonly cursorUpdatedAt?: Date; readonly cursorId?: string }) {
    return this.db.providerDocumentVersion.findMany({
      where: {
        providerId: input.providerId,
        ...(input.cursorUpdatedAt === undefined || input.cursorId === undefined ? {} : {
          OR: [
            { updatedAt: { lt: input.cursorUpdatedAt } },
            { updatedAt: input.cursorUpdatedAt, id: { lt: input.cursorId } },
          ],
        }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: Math.min(101, Math.max(1, input.limit)),
      include: { chain: { include: { documentType: true } }, evidence: true },
    });
  }

  public async bindEvidence(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly mediaFileId: string;
    readonly position: number;
    readonly canonicalContentType: string;
    readonly byteSize: number;
    readonly pageCount: number | null;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const operationKey = `document-evidence-bind:${input.commandId}`;
    const mutationTargetId = documentMutationFingerprint([
      input.documentVersionId, input.mediaFileId, input.position, input.canonicalContentType,
      input.byteSize, input.pageCount,
    ]);
    const readPrior = async () => {
      const [history, evidence] = await Promise.all([
        this.db.providerVerificationHistory.findUnique({ where: { operationKey } }),
        this.db.providerDocumentEvidence.findUnique({ where: { idempotencyKey: input.commandId } }),
      ]);
      if (history === null && evidence === null) return null;
      if (
        history === null || evidence === null ||
        history.event !== "DOCUMENT_EVIDENCE_BOUND" ||
        history.providerId !== input.providerId ||
        history.documentVersionId !== input.documentVersionId ||
        history.exactVersion !== input.expectedVersion ||
        history.actorUserId !== input.actorUserId ||
        history.requestId !== input.requestId ||
        history.mutationTargetId !== mutationTargetId ||
        evidence.documentVersionId !== input.documentVersionId ||
        evidence.mediaFileId !== input.mediaFileId ||
        evidence.position !== input.position ||
        evidence.canonicalContentType !== input.canonicalContentType ||
        evidence.byteSize !== input.byteSize ||
        evidence.pageCount !== input.pageCount ||
        evidence.expectedDocumentVersion !== input.expectedVersion ||
        evidence.boundByUserId !== input.actorUserId
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return this.db.providerDocumentVersion.findUniqueOrThrow({
        where: { id: input.documentVersionId }, include: { evidence: true },
      });
    };
    const prior = await readPrior();
    if (prior !== null) return prior;
    try {
      return await this.db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.documentVersionId} FOR UPDATE`;
        await this.assertDocumentMutationAuthority(transaction, input);
        const updated = await transaction.providerDocumentVersion.updateMany({
          where: { id: input.documentVersionId, providerId: input.providerId, status: "DRAFT", version: input.expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
        await transaction.providerDocumentEvidence.create({
          data: {
            documentVersionId: input.documentVersionId,
            mediaFileId: input.mediaFileId,
            position: input.position,
            canonicalContentType: input.canonicalContentType,
            byteSize: input.byteSize,
            pageCount: input.pageCount,
            expectedDocumentVersion: input.expectedVersion,
            boundByUserId: input.actorUserId,
            idempotencyKey: input.commandId,
          },
        });
        await transaction.providerVerificationHistory.create({
          data: {
            providerId: input.providerId,
            documentVersionId: input.documentVersionId,
            event: "DOCUMENT_EVIDENCE_BOUND",
            fromStatus: "DRAFT",
            toStatus: "DRAFT",
            actorType: "USER",
            actorUserId: input.actorUserId,
            requestId: input.requestId,
            mutationTargetId,
            exactVersion: input.expectedVersion,
            operationKey,
          },
        });
        return transaction.providerDocumentVersion.findUniqueOrThrow({
          where: { id: input.documentVersionId }, include: { evidence: true },
        });
      });
    } catch (error) {
      const retry = await readPrior();
      if (retry !== null) return retry;
      throw error;
    }
  }

  public async removeEvidence(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly evidenceId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<{ readonly mediaFileId: string; readonly version: number }> {
    const operationKey = `document-evidence-remove:${input.commandId}`;
    const readPrior = async () => {
      const prior = await this.db.providerVerificationHistory.findUnique({ where: { operationKey } });
      if (prior === null) return null;
      const target = prior.mutationTargetId?.split("|");
      if (
        prior.event !== "DOCUMENT_EVIDENCE_REMOVED" ||
        prior.providerId !== input.providerId ||
        prior.documentVersionId !== input.documentVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId ||
        target?.length !== 2 || target[0] !== input.evidenceId || target[1] === undefined || target[1].length === 0
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return { mediaFileId: target[1], version: input.expectedVersion + 1 };
    };
    const prior = await readPrior();
    if (prior !== null) return prior;
    try {
      return await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.documentVersionId} FOR UPDATE`;
      await this.assertDocumentMutationAuthority(transaction, input);
      const changed = await transaction.providerDocumentVersion.updateMany({
        where: {
          id: input.documentVersionId,
          providerId: input.providerId,
          status: "DRAFT",
          version: input.expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
      const evidence = await transaction.providerDocumentEvidence.findFirst({
        where: { id: input.evidenceId, documentVersionId: input.documentVersionId },
      });
      if (evidence === null) throw new Error("DOCUMENT_STATE_CONFLICT");
      await transaction.providerDocumentEvidence.delete({ where: { id: evidence.id } });
      await transaction.providerVerificationHistory.create({
        data: {
          providerId: input.providerId,
          documentVersionId: input.documentVersionId,
          event: "DOCUMENT_EVIDENCE_REMOVED",
          fromStatus: "DRAFT",
          toStatus: "DRAFT",
          actorType: "USER",
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          mutationTargetId: `${input.evidenceId}|${evidence.mediaFileId}`,
          exactVersion: input.expectedVersion,
          operationKey,
        },
      });
      return { mediaFileId: evidence.mediaFileId, version: input.expectedVersion + 1 };
      });
    } catch (error) {
      const retry = await readPrior();
      if (retry !== null) return retry;
      throw error;
    }
  }

  public async reorderEvidence(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly evidenceIds: readonly string[];
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<{ readonly version: number }> {
    const operationKey = `document-evidence-reorder:${input.commandId}`;
    const mutationTargetId = documentMutationFingerprint([input.documentVersionId, ...input.evidenceIds]);
    const readPrior = async () => {
      const prior = await this.db.providerVerificationHistory.findUnique({ where: { operationKey } });
      if (prior === null) return null;
      if (
        prior.event !== "DOCUMENT_EVIDENCE_REORDERED" ||
        prior.providerId !== input.providerId ||
        prior.documentVersionId !== input.documentVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId ||
        prior.mutationTargetId !== mutationTargetId
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return { version: input.expectedVersion + 1 };
    };
    const prior = await readPrior();
    if (prior !== null) return prior;
    try {
      return await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.documentVersionId} FOR UPDATE`;
      await this.assertDocumentMutationAuthority(transaction, input);
      const changed = await transaction.providerDocumentVersion.updateMany({
        where: {
          id: input.documentVersionId,
          providerId: input.providerId,
          status: "DRAFT",
          version: input.expectedVersion,
        },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
      const evidence = await transaction.providerDocumentEvidence.findMany({
        where: { documentVersionId: input.documentVersionId },
        select: { id: true, canonicalContentType: true },
      });
      if (
        evidence.length !== input.evidenceIds.length ||
        new Set(input.evidenceIds).size !== input.evidenceIds.length ||
        evidence.some((item) => !input.evidenceIds.includes(item.id)) ||
        evidence.some((item) => item.canonicalContentType === "application/pdf")
      ) throw new Error("DOCUMENT_EVIDENCE_INVALID");
      // Use temporary negative positions so the unique document/position index
      // cannot be violated while two existing rows exchange places.
      for (const [index, evidenceId] of input.evidenceIds.entries()) {
        await transaction.providerDocumentEvidence.update({
          where: { id: evidenceId }, data: { position: -(index + 1) },
        });
      }
      for (const [index, evidenceId] of input.evidenceIds.entries()) {
        await transaction.providerDocumentEvidence.update({
          where: { id: evidenceId }, data: { position: index },
        });
      }
      await transaction.providerVerificationHistory.create({
        data: {
          providerId: input.providerId,
          documentVersionId: input.documentVersionId,
          event: "DOCUMENT_EVIDENCE_REORDERED",
          fromStatus: "DRAFT",
          toStatus: "DRAFT",
          actorType: "USER",
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          mutationTargetId,
          exactVersion: input.expectedVersion,
          operationKey,
        },
      });
      return { version: input.expectedVersion + 1 };
      });
    } catch (error) {
      const retry = await readPrior();
      if (retry !== null) return retry;
      throw error;
    }
  }

  public async submitDocument(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly policyVersionId: string;
    readonly policyItemId: string;
    readonly policyRuleSnapshot: Prisma.InputJsonValue;
    readonly evidenceFormat: "PDF" | "IMAGE_SET";
    readonly commandId: string;
    readonly requestId: string;
    readonly now: Date;
  }) {
    const replay = await this.findDocumentSubmitReplay(input);
    if (replay !== null) return replay;
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.documentVersionId} FOR UPDATE`;
      const operationKey = `document-submit:${input.documentVersionId}:${input.commandId}`;
      const prior = await transaction.providerVerificationHistory.findUnique({ where: { operationKey } });
      if (prior !== null) {
        const current = await transaction.providerDocumentVersion.findUniqueOrThrow({ where: { id: input.documentVersionId } });
        if (
          prior.providerId !== input.providerId ||
          prior.documentVersionId !== input.documentVersionId ||
          prior.policyVersionId !== input.policyVersionId ||
          prior.exactVersion !== input.expectedVersion ||
          prior.actorUserId !== input.actorUserId ||
          prior.requestId !== input.requestId ||
          current.status !== "SUBMITTED" ||
          current.version !== input.expectedVersion + 1 ||
          current.policyVersionId !== input.policyVersionId ||
          current.policyItemId !== input.policyItemId ||
          current.evidenceFormat !== input.evidenceFormat
        ) throw new Error("DOCUMENT_VERSION_CONFLICT");
        return current;
      }
      const document = await transaction.providerDocumentVersion.findFirst({
        where: { id: input.documentVersionId, providerId: input.providerId, status: "DRAFT", version: input.expectedVersion },
        include: { chain: true, evidence: true },
      });
      if (document === null || document.evidence.length === 0) throw new Error("DOCUMENT_VERSION_CONFLICT");
      const evidenceAuthorizer = this.createEvidenceAuthorizer?.(transaction);
      if (
        evidenceAuthorizer === undefined ||
        !(await evidenceAuthorizer.allReady({
          providerId: input.providerId,
          documentVersionId: input.documentVersionId,
          evidence: document.evidence.map((item) => ({
            mediaFileId: item.mediaFileId,
            canonicalContentType: item.canonicalContentType as "application/pdf" | "image/jpeg" | "image/png",
            byteSize: item.byteSize,
            pageCount: item.pageCount,
          })),
        }))
      ) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
      const authority = await this.assertDocumentMutationAuthority(transaction, {
        providerId: input.providerId,
        actorUserId: input.actorUserId,
        countryCode: document.countryCode,
      });
      const policy = await transaction.verificationDocumentPolicyVersion.findFirst({
        where: {
          countryId: authority.countryId,
          providerKind: "REGISTERED_COMPANY",
          status: "PUBLISHED",
          effectiveAt: { lte: input.now },
          items: {
            some: {
              id: input.policyItemId,
              documentTypeId: document.chain.documentTypeId,
              isRequired: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ policyVersion: "desc" }, { id: "desc" }],
        include: { items: { where: { id: input.policyItemId } } },
      });
      const policyItem = policy?.items[0];
      if (
        policy?.id !== input.policyVersionId ||
        policyItem === undefined ||
        canonicalJson(policyItem.fieldRules) !== canonicalJson(input.policyRuleSnapshot)
      ) {
        throw new Error("VERIFICATION_POLICY_NOT_FOUND");
      }
      const updated = await transaction.providerDocumentVersion.updateMany({
        where: { id: input.documentVersionId, providerId: input.providerId, status: "DRAFT", version: input.expectedVersion },
        data: {
          status: "SUBMITTED",
          version: { increment: 1 },
          submittedByUserId: input.actorUserId,
          submittedAt: input.now,
          policyVersionId: input.policyVersionId,
          policyItemId: input.policyItemId,
          policyRuleSnapshot: input.policyRuleSnapshot,
          evidenceFormat: input.evidenceFormat,
        },
      });
      if (updated.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
      await transaction.providerVerificationHistory.create({
        data: {
          providerId: input.providerId,
          documentVersionId: input.documentVersionId,
          policyVersionId: input.policyVersionId,
          event: "DOCUMENT_SUBMITTED",
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
          actorType: "USER",
          actorUserId: input.actorUserId,
          exactVersion: input.expectedVersion,
          requestId: input.requestId,
          operationKey,
        },
      });
      return transaction.providerDocumentVersion.findUniqueOrThrow({ where: { id: input.documentVersionId } });
    });
  }

  public async findDocumentSubmitReplay(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<ProviderDocumentVersion | null> {
    const operationKey = `document-submit:${input.documentVersionId}:${input.commandId}`;
    const prior = await this.db.providerVerificationHistory.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    const current = await this.db.providerDocumentVersion.findUniqueOrThrow({ where: { id: input.documentVersionId } });
    if (
      prior.event !== "DOCUMENT_SUBMITTED" ||
      prior.providerId !== input.providerId ||
      prior.documentVersionId !== input.documentVersionId ||
      prior.exactVersion !== input.expectedVersion ||
      prior.actorUserId !== input.actorUserId ||
      prior.requestId !== input.requestId ||
      current.providerId !== input.providerId ||
      current.version < input.expectedVersion + 1 ||
      current.submittedByUserId !== input.actorUserId ||
      current.submittedAt === null
    ) throw new Error("DOCUMENT_VERSION_CONFLICT");
    return current;
  }

  public async createSuccessor(input: {
    readonly providerId: string;
    readonly predecessorVersionId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }): Promise<ProviderDocumentVersion> {
    const existing = await this.db.providerDocumentVersion.findUnique({ where: { idempotencyKey: input.commandId } });
    if (existing !== null) {
      const prior = await this.db.providerVerificationHistory.findUnique({
        where: { operationKey: `document-successor:${input.commandId}` },
      });
      if (
        prior === null ||
        prior.event !== "DOCUMENT_DRAFT_CREATED" ||
        prior.providerId !== input.providerId ||
        prior.documentVersionId !== existing.id ||
        prior.mutationTargetId !== input.predecessorVersionId ||
        prior.exactVersion !== input.expectedVersion ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId ||
        existing.providerId !== input.providerId ||
        existing.predecessorVersionId !== input.predecessorVersionId ||
        existing.createdByUserId !== input.actorUserId ||
        existing.sequence < 2
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return existing;
    }
    try {
      return await this.db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.predecessorVersionId} FOR UPDATE`;
        await this.assertDocumentMutationAuthority(transaction, input);
        const predecessor = await transaction.providerDocumentVersion.findFirst({
        where: {
          id: input.predecessorVersionId,
          providerId: input.providerId,
          version: input.expectedVersion,
          status: { in: ["APPROVED", "REJECTED", "REPLACEMENT_REQUESTED", "EXPIRED", "INVALIDATED"] },
        },
      });
      if (predecessor === null) throw new Error("DOCUMENT_VERSION_CONFLICT");
      const open = await transaction.providerDocumentVersion.findFirst({
        where: { predecessorVersionId: predecessor.id, status: { in: ["DRAFT", "SUBMITTED", "APPROVED", "REPLACEMENT_REQUESTED"] } },
      });
      if (open !== null) throw new Error("DOCUMENT_STATE_CONFLICT");
        const successor = await transaction.providerDocumentVersion.create({
        data: {
          chainId: predecessor.chainId,
          providerId: predecessor.providerId,
          sequence: predecessor.sequence + 1,
          predecessorVersionId: predecessor.id,
          countryCode: predecessor.countryCode,
          documentNumber: predecessor.documentNumber,
          legalName: predecessor.legalName,
          issuerName: predecessor.issuerName,
          issueDate: predecessor.issueDate,
          expiresAt: predecessor.expiresAt,
          createdByUserId: input.actorUserId,
          idempotencyKey: input.commandId,
        },
        });
        await transaction.providerVerificationHistory.create({
          data: {
            providerId: input.providerId,
            documentVersionId: successor.id,
            event: "DOCUMENT_DRAFT_CREATED",
            fromStatus: predecessor.status,
            toStatus: "DRAFT",
            actorType: "USER",
            actorUserId: input.actorUserId,
            exactVersion: input.expectedVersion,
            requestId: input.requestId,
            mutationTargetId: input.predecessorVersionId,
            operationKey: `document-successor:${input.commandId}`,
          },
        });
        return successor;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const retry = await this.db.providerDocumentVersion.findUnique({ where: { idempotencyKey: input.commandId } });
        if (retry !== null) return this.createSuccessor(input);
      }
      throw error;
    }
  }

  public async decideDocument(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly outcome: "APPROVE" | "REJECT" | "REQUEST_REPLACEMENT" | "INVALIDATE";
    readonly reason: string;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
    readonly now: Date;
  }) {
    const replay = await this.findDocumentDecisionReplay(input);
    if (replay !== null) return replay;
    const operationKey = `document-decision:${input.documentVersionId}:${input.commandId}`;
    const prior = await this.db.providerDocumentReview.findUnique({ where: { operationKey } });
    if (prior !== null) {
      if (
        prior.providerId !== input.providerId ||
        prior.documentVersionId !== input.documentVersionId ||
        prior.expectedDocumentVersion !== input.expectedVersion ||
        prior.outcome !== input.outcome ||
        prior.reason !== input.reason ||
        prior.actorUserId !== input.actorUserId ||
        prior.requestId !== input.requestId
      ) throw new Error("DOCUMENT_VERSION_CONFLICT");
      return prior;
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM providers WHERE id = ${input.providerId} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM provider_document_versions WHERE id = ${input.documentVersionId} FOR UPDATE`;
      const approvedProvider = await transaction.provider.findFirst({
        where: { id: input.providerId, kind: "REGISTERED_COMPANY", applicationStatus: "APPROVED" },
        select: { id: true },
      });
      if (approvedProvider === null) throw new Error("PROVIDER_NOT_APPROVED");
      await this.assertStaffPermission(transaction, input.actorUserId, "providers.verification.documents.review");
      const row = await transaction.providerDocumentVersion.findFirst({
        where: { id: input.documentVersionId, providerId: input.providerId },
        include: { evidence: true },
      });
      if (row === null || row.version !== input.expectedVersion) throw new Error("DOCUMENT_VERSION_CONFLICT");
      if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
      assertSafeNoteExcludesProtectedValues(input.reason, [row.documentNumber, row.legalName, row.issuerName]);
      const target = input.outcome === "APPROVE" ? "APPROVED"
        : input.outcome === "REJECT" ? "REJECTED"
        : input.outcome === "REQUEST_REPLACEMENT" ? "REPLACEMENT_REQUESTED"
        : "INVALIDATED";
      const legal = (row.status === "SUBMITTED" && target !== "INVALIDATED") ||
        (row.status === "APPROVED" && ["REPLACEMENT_REQUESTED", "INVALIDATED"].includes(target));
      if (!legal) throw new Error("DOCUMENT_STATE_CONFLICT");
      if (target === "APPROVED" && row.expiresAt !== null && row.expiresAt <= input.now) {
        throw new Error("DOCUMENT_STATE_CONFLICT");
      }
      if (target === "APPROVED") {
        const evidenceAuthorizer = this.createEvidenceAuthorizer?.(transaction);
        if (
          evidenceAuthorizer === undefined ||
          !(await evidenceAuthorizer.allReady({
            providerId: input.providerId,
            documentVersionId: input.documentVersionId,
            evidence: row.evidence.map((item) => ({
              mediaFileId: item.mediaFileId,
              canonicalContentType: item.canonicalContentType as "application/pdf" | "image/jpeg" | "image/png",
              byteSize: item.byteSize,
              pageCount: item.pageCount,
            })),
          }))
        ) throw new Error("DOCUMENT_EVIDENCE_NOT_READY");
      }
      await transaction.providerDocumentVersion.update({
        where: { id: row.id },
        data: {
          status: target,
          version: { increment: 1 },
          ...(target === "APPROVED" ? { approvedAt: input.now } : {}),
          ...(target === "REJECTED" ? { rejectedAt: input.now } : {}),
          ...(target === "REPLACEMENT_REQUESTED" ? { replacementRequestedAt: input.now } : {}),
          ...(target === "INVALIDATED" ? { invalidatedAt: input.now } : {}),
        },
      });
      let supersededPredecessor: { readonly id: string; readonly version: number } | null = null;
      if (target === "APPROVED") {
        await transaction.providerDocumentChain.update({
          where: { id: row.chainId }, data: { effectiveVersionId: row.id, version: { increment: 1 } },
        });
        if (row.predecessorVersionId !== null) {
          supersededPredecessor = await transaction.providerDocumentVersion.findFirst({
            where: { id: row.predecessorVersionId, status: "APPROVED" },
            select: { id: true, version: true },
          });
          await transaction.providerDocumentVersion.updateMany({
            where: { id: row.predecessorVersionId, status: "APPROVED" },
            data: { status: "SUPERSEDED", supersededAt: input.now, version: { increment: 1 } },
          });
        }
      } else if (row.status === "APPROVED") {
        await transaction.providerDocumentChain.updateMany({
          where: { id: row.chainId, effectiveVersionId: row.id },
          data: { effectiveVersionId: null, version: { increment: 1 } },
        });
      }
      const review = await transaction.providerDocumentReview.create({
        data: {
          providerId: input.providerId,
          documentVersionId: row.id,
          outcome: input.outcome,
          reason: input.reason,
          actorUserId: input.actorUserId,
          decidedAt: input.now,
          requestId: input.requestId,
          expectedDocumentVersion: input.expectedVersion,
          operationKey,
        },
      });
      await transaction.providerVerificationHistory.create({
        data: {
          providerId: input.providerId,
          documentVersionId: row.id,
          event: target === "APPROVED" ? "DOCUMENT_APPROVED" : target === "REJECTED" ? "DOCUMENT_REJECTED" : target === "INVALIDATED" ? "DOCUMENT_INVALIDATED" : "DOCUMENT_REPLACEMENT_REQUESTED",
          fromStatus: row.status,
          toStatus: target,
          actorType: "USER",
          actorUserId: input.actorUserId,
          reasonText: input.reason,
          requestId: input.requestId,
          exactVersion: input.expectedVersion,
          operationKey: `history:${operationKey}`,
        },
      });
      if (supersededPredecessor !== null) {
        await transaction.providerVerificationHistory.create({
          data: {
            providerId: input.providerId,
            documentVersionId: supersededPredecessor.id,
            event: "DOCUMENT_SUPERSEDED",
            fromStatus: "APPROVED",
            toStatus: "SUPERSEDED",
            actorType: "USER",
            actorUserId: input.actorUserId,
            reasonText: input.reason,
            requestId: input.requestId,
            exactVersion: supersededPredecessor.version,
            operationKey: `supersede:${operationKey}`,
          },
        });
      }
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: `PROVIDER_VERIFICATION_DOCUMENT_${input.outcome}`,
        targetType: "PROVIDER_DOCUMENT_VERSION",
        targetId: row.id,
        reason: input.reason,
        requestId: input.requestId,
        context: { providerId: input.providerId, expectedVersion: input.expectedVersion, outcome: input.outcome },
      });
      return review;
    });
  }

  public async findDocumentDecisionReplay(input: {
    readonly providerId: string;
    readonly documentVersionId: string;
    readonly expectedVersion: number;
    readonly outcome: "APPROVE" | "REJECT" | "REQUEST_REPLACEMENT" | "INVALIDATE";
    readonly reason: string;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly requestId: string;
  }) {
    const operationKey = `document-decision:${input.documentVersionId}:${input.commandId}`;
    const prior = await this.db.providerDocumentReview.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    if (
      prior.providerId !== input.providerId ||
      prior.documentVersionId !== input.documentVersionId ||
      prior.expectedDocumentVersion !== input.expectedVersion ||
      prior.outcome !== input.outcome ||
      prior.reason !== input.reason ||
      prior.actorUserId !== input.actorUserId ||
      prior.requestId !== input.requestId
    ) throw new Error("DOCUMENT_VERSION_CONFLICT");
    return prior;
  }

  public async listDocumentReviewQueue(input: { readonly limit: number; readonly cursorSubmittedAt?: Date; readonly cursorId?: string }) {
    return this.db.providerDocumentVersion.findMany({
      where: {
        status: "SUBMITTED",
        ...(input.cursorSubmittedAt === undefined || input.cursorId === undefined ? {} : {
          OR: [
            { submittedAt: { gt: input.cursorSubmittedAt } },
            { submittedAt: input.cursorSubmittedAt, id: { gt: input.cursorId } },
          ],
        }),
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      take: Math.min(101, Math.max(1, input.limit)),
      include: { chain: { include: { documentType: true } }, evidence: true },
    });
  }

  public async listHistory(providerId: string, limit = 20, cursor?: { readonly createdAt: Date; readonly id: string }) {
    return this.db.providerVerificationHistory.findMany({
      where: {
        providerId,
        ...(cursor === undefined ? {} : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(101, Math.max(1, limit)),
    });
  }

  public async expireApproved(now: Date, limit = 100): Promise<number> {
    const candidates = await this.db.providerDocumentVersion.findMany({
      where: { status: "APPROVED", expiresAt: { lte: now } },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: Math.min(100, Math.max(1, limit)),
      select: { id: true, chainId: true, providerId: true, version: true },
    });
    for (const row of candidates) {
      await this.db.$transaction(async (transaction) => {
        const changed = await transaction.providerDocumentVersion.updateMany({
          where: { id: row.id, status: "APPROVED", version: row.version },
          data: { status: "EXPIRED", expiredAt: now, version: { increment: 1 } },
        });
        if (changed.count === 0) return;
        await transaction.providerDocumentChain.updateMany({
          where: { id: row.chainId, effectiveVersionId: row.id }, data: { effectiveVersionId: null, version: { increment: 1 } },
        });
        await transaction.providerVerificationHistory.create({
          data: {
            providerId: row.providerId, documentVersionId: row.id, event: "DOCUMENT_EXPIRED",
            fromStatus: "APPROVED", toStatus: "EXPIRED", actorType: "SYSTEM",
            exactVersion: row.version, operationKey: `document-expiry:${row.id}:${row.version}`,
          },
        });
      });
    }
    return candidates.length;
  }

  public listDocumentTypes() {
    return this.db.verificationDocumentType.findMany({ orderBy: [{ code: "asc" }] });
  }

  public listPolicies(input: { readonly limit: number; readonly cursorCreatedAt?: Date; readonly cursorId?: string }) {
    return this.db.verificationDocumentPolicyVersion.findMany({
      where: input.cursorCreatedAt === undefined || input.cursorId === undefined ? {} : {
        OR: [
          { createdAt: { lt: input.cursorCreatedAt } },
          { createdAt: input.cursorCreatedAt, id: { lt: input.cursorId } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(101, Math.max(1, input.limit)),
      include: { country: true, items: { orderBy: { position: "asc" }, include: { documentType: true } } },
    });
  }

  public readPolicy(policyVersionId: string) {
    return this.db.verificationDocumentPolicyVersion.findUnique({
      where: { id: policyVersionId },
      include: { country: true, items: { orderBy: { position: "asc" }, include: { documentType: true } } },
    });
  }

  public async createPolicyDraft(input: {
    readonly countryCode: string;
    readonly providerKind: "REGISTERED_COMPANY";
    readonly effectiveAt: Date;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly items: readonly {
      readonly documentTypeCode: string;
      readonly isRequired: boolean;
      readonly isActive: boolean;
      readonly position: number;
      readonly fieldRules: Prisma.InputJsonValue;
    }[];
  }): Promise<VerificationDocumentPolicyVersion> {
    const prior = await this.db.verificationDocumentPolicyVersion.findUnique({
      where: { idempotencyKey: input.commandId },
      include: { country: true, items: { include: { documentType: true } } },
    });
    if (prior !== null) {
      if (
        prior.country.code !== input.countryCode ||
        prior.providerKind !== input.providerKind ||
        prior.effectiveAt?.getTime() !== input.effectiveAt.getTime() ||
        prior.createdByUserId !== input.actorUserId ||
        !samePolicyItems(prior.items, input.items)
      ) throw new Error("POLICY_VERSION_CONFLICT");
      return prior;
    }
    try {
      return await this.db.$transaction(async (transaction) => {
      await this.assertStaffPermission(transaction, input.actorUserId, "providers.verification.policies.manage");
      const country = await transaction.country.findFirst({ where: { code: input.countryCode, isActive: true } });
      if (country === null) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
      const existingDraft = await transaction.verificationDocumentPolicyVersion.findFirst({
        where: { countryId: country.id, providerKind: input.providerKind, status: "DRAFT" },
      });
      if (existingDraft !== null) throw new Error("POLICY_VERSION_CONFLICT");
      const highest = await transaction.verificationDocumentPolicyVersion.findFirst({
        where: { countryId: country.id, providerKind: input.providerKind }, orderBy: { policyVersion: "desc" }, select: { policyVersion: true },
      });
      const types = await transaction.verificationDocumentType.findMany({
        where: { code: { in: input.items.map((item) => item.documentTypeCode) }, isActive: true },
      });
      if (types.length !== input.items.length) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
      const typeByCode = new Map(types.map((type) => [type.code, type.id]));
      const policy = await transaction.verificationDocumentPolicyVersion.create({
        data: {
          countryId: country.id,
          providerKind: input.providerKind,
          policyVersion: (highest?.policyVersion ?? 0) + 1,
          effectiveAt: input.effectiveAt,
          idempotencyKey: input.commandId,
          createdByUserId: input.actorUserId,
          items: {
            create: input.items.map((item) => ({
              documentTypeId: typeByCode.get(item.documentTypeCode) ?? "",
              isRequired: item.isRequired,
              isActive: item.isActive,
              position: item.position,
              fieldRules: item.fieldRules,
            })),
          },
        },
        include: { items: true },
      });
        return policy;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.createPolicyDraft(input);
      }
      throw error;
    }
  }

  public async replacePolicyDraft(input: {
    readonly policyVersionId: string;
    readonly expectedVersion: number;
    readonly effectiveAt: Date;
    readonly actorUserId: string;
    readonly commandId: string;
    readonly items: readonly {
      readonly documentTypeCode: string;
      readonly isRequired: boolean;
      readonly isActive: boolean;
      readonly position: number;
      readonly fieldRules: Prisma.InputJsonValue;
    }[];
  }) {
    const retryKey = `${input.policyVersionId}:replace:${input.commandId}`;
    const retry = await this.db.verificationDocumentPolicyVersion.findUnique({
      where: { lastMutationKey: retryKey },
      include: { items: { include: { documentType: true } } },
    });
    if (retry !== null) {
      if (
        retry.version !== input.expectedVersion + 1 ||
        retry.effectiveAt?.getTime() !== input.effectiveAt.getTime() ||
        retry.lastMutationActorUserId !== input.actorUserId ||
        !samePolicyItems(retry.items, input.items)
      ) throw new Error("POLICY_VERSION_CONFLICT");
      return retry;
    }
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM verification_document_policy_versions WHERE id = ${input.policyVersionId} FOR UPDATE`;
      await this.assertStaffPermission(transaction, input.actorUserId, "providers.verification.policies.manage");
      const policy = await transaction.verificationDocumentPolicyVersion.findUnique({
        where: { id: input.policyVersionId },
        include: { items: { include: { documentType: true } } },
      });
      if (policy?.lastMutationKey === retryKey) {
        if (
          policy.version !== input.expectedVersion + 1 ||
          policy.effectiveAt?.getTime() !== input.effectiveAt.getTime() ||
          policy.lastMutationActorUserId !== input.actorUserId ||
          !samePolicyItems(policy.items, input.items)
        ) throw new Error("POLICY_VERSION_CONFLICT");
        return policy;
      }
      if (policy === null || policy.status !== "DRAFT" || policy.version !== input.expectedVersion) {
        throw new Error("POLICY_VERSION_CONFLICT");
      }
      const types = await transaction.verificationDocumentType.findMany({
        where: { code: { in: input.items.map((item) => item.documentTypeCode) }, isActive: true },
      });
      if (types.length !== input.items.length) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
      const typeByCode = new Map(types.map((type) => [type.code, type.id]));
      await transaction.verificationDocumentPolicyItem.deleteMany({ where: { policyVersionId: policy.id } });
      await transaction.verificationDocumentPolicyItem.createMany({
        data: input.items.map((item) => ({
          policyVersionId: policy.id,
          documentTypeId: typeByCode.get(item.documentTypeCode) ?? "",
          isRequired: item.isRequired,
          isActive: item.isActive,
          position: item.position,
          fieldRules: item.fieldRules,
        })),
      });
      await transaction.verificationDocumentPolicyVersion.update({
        where: { id: policy.id },
        data: {
          effectiveAt: input.effectiveAt,
          lastMutationKey: retryKey,
          lastMutationActorUserId: input.actorUserId,
          version: { increment: 1 },
        },
      });
      return transaction.verificationDocumentPolicyVersion.findUniqueOrThrow({
        where: { id: policy.id }, include: { items: true },
      });
    });
  }

  public async publishPolicy(input: {
    readonly policyVersionId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly reason: string;
    readonly commandId: string;
    readonly now: Date;
  }) {
    const replay = await this.findPolicyPublishReplay(input);
    if (replay !== null) return replay;
    return this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM verification_document_policy_versions WHERE id = ${input.policyVersionId} FOR UPDATE`;
      await this.assertStaffPermission(transaction, input.actorUserId, "providers.verification.policies.manage");
      const operationKey = `policy-publish:${input.policyVersionId}:${input.commandId}`;
      const prior = await transaction.providerVerificationHistory.findUnique({ where: { operationKey } });
      if (prior !== null) {
        if (
          prior.policyVersionId !== input.policyVersionId ||
          prior.exactVersion !== input.expectedVersion ||
          prior.actorUserId !== input.actorUserId ||
          prior.reasonText !== input.reason
        ) throw new Error("POLICY_VERSION_CONFLICT");
        return transaction.verificationDocumentPolicyVersion.findUniqueOrThrow({ where: { id: input.policyVersionId } });
      }
      const policy = await transaction.verificationDocumentPolicyVersion.findFirst({
        where: { id: input.policyVersionId, status: "DRAFT", version: input.expectedVersion },
        include: { country: true, items: { include: { documentType: true } } },
      });
      if (
        policy === null ||
        policy.effectiveAt === null ||
        policy.items.length === 0 ||
        !policy.country.isActive ||
        policy.items.some((item) => !item.documentType.isActive)
      ) throw new Error("POLICY_VERSION_CONFLICT");
      const changed = await transaction.verificationDocumentPolicyVersion.updateMany({
        where: { id: input.policyVersionId, status: "DRAFT", version: input.expectedVersion },
        data: {
          status: "PUBLISHED",
          publishedByUserId: input.actorUserId,
          publishedAt: input.now,
          publishReason: input.reason,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new Error("POLICY_VERSION_CONFLICT");
      await transaction.providerVerificationHistory.create({
        data: {
          policyVersionId: input.policyVersionId,
          event: "POLICY_PUBLISHED",
          actorType: "USER",
          actorUserId: input.actorUserId,
          reasonText: input.reason,
          exactVersion: input.expectedVersion,
          operationKey,
        },
      });
      await this.createAuditWriter?.(transaction).append({
        actorType: "USER",
        actorId: input.actorUserId,
        action: "PROVIDER_VERIFICATION_POLICY_PUBLISHED",
        targetType: "VERIFICATION_DOCUMENT_POLICY_VERSION",
        targetId: input.policyVersionId,
        reason: input.reason,
        context: { expectedVersion: input.expectedVersion, outcome: "PUBLISHED" },
      });
      return transaction.verificationDocumentPolicyVersion.findUniqueOrThrow({ where: { id: input.policyVersionId } });
    });
  }

  public async findPolicyPublishReplay(input: {
    readonly policyVersionId: string;
    readonly expectedVersion: number;
    readonly actorUserId: string;
    readonly reason: string;
    readonly commandId: string;
  }): Promise<VerificationDocumentPolicyVersion | null> {
    const operationKey = `policy-publish:${input.policyVersionId}:${input.commandId}`;
    const prior = await this.db.providerVerificationHistory.findUnique({ where: { operationKey } });
    if (prior === null) return null;
    if (
      prior.event !== "POLICY_PUBLISHED" ||
      prior.policyVersionId !== input.policyVersionId ||
      prior.exactVersion !== input.expectedVersion ||
      prior.actorUserId !== input.actorUserId ||
      prior.reasonText !== input.reason
    ) throw new Error("POLICY_VERSION_CONFLICT");
    return this.db.verificationDocumentPolicyVersion.findUniqueOrThrow({ where: { id: input.policyVersionId } });
  }

  public async activateEffectivePolicyBatch(input: {
    readonly cursor: string | null;
    readonly limit: number;
    readonly now: Date;
  }): Promise<{ readonly processed: number; readonly nextCursor: string | null }> {
    const activationState = await this.db.providerPolicyActivationState.upsert({
      where: { id: "document-policy-activation" },
      update: {},
      create: { id: "document-policy-activation" },
    });
    if (input.cursor !== null && input.cursor !== activationState.cursor) {
      throw new Error("POLICY_VERSION_CONFLICT");
    }
    const effectiveCursor = activationState.cursor;
    const providers = await this.db.provider.findMany({
      where: {
        kind: "REGISTERED_COMPANY",
        applicationStatus: "APPROVED",
        ...(effectiveCursor === null ? {} : { id: { gt: effectiveCursor } }),
        profile: { countryId: { not: null } },
      },
      orderBy: { id: "asc" },
      take: Math.min(100, Math.max(1, input.limit)),
      select: { id: true, profile: { select: { countryId: true } } },
    });
    for (const provider of providers) {
      const countryId = provider.profile?.countryId;
      if (countryId === null || countryId === undefined) continue;
      const policy = await this.readEffectivePolicy({
        countryId,
        providerKind: "REGISTERED_COMPANY",
        now: input.now,
      });
      if (policy === null) continue;
      const [previousPolicy, effectiveApprovedTypeCodes] = await Promise.all([
        this.db.verificationDocumentPolicyVersion.findFirst({
          where: {
            countryId,
            providerKind: "REGISTERED_COMPANY",
            status: "PUBLISHED",
            policyVersion: { lt: policy.policyVersion },
            effectiveAt: { lte: input.now },
          },
          orderBy: [{ policyVersion: "desc" }, { id: "desc" }],
          include: {
            items: {
              where: { isActive: true },
              orderBy: [{ position: "asc" }, { id: "asc" }],
              include: { documentType: true },
            },
          },
        }),
        this.listEffectiveDocumentTypeCodes(provider.id, input.now),
      ]);
      const previousTruth = deriveDocumentVerificationTruth({
        providerKind: "REGISTERED_COMPANY",
        applicationStatus: "APPROVED",
        effectivePolicyPresent: previousPolicy !== null,
        requiredTypeCodes: previousPolicy?.items
          .filter((item) => item.isRequired)
          .map((item) => item.documentType.code) ?? [],
        effectiveApprovedTypeCodes,
      });
      const currentTruth = deriveDocumentVerificationTruth({
        providerKind: "REGISTERED_COMPANY",
        applicationStatus: "APPROVED",
        effectivePolicyPresent: true,
        requiredTypeCodes: policy.items
          .filter((item) => item.isRequired)
          .map((item) => item.documentType.code),
        effectiveApprovedTypeCodes,
      });
      await this.db.$transaction(async (transaction) => {
        await transaction.providerVerificationHistory.upsert({
          where: { operationKey: `policy-effective:${policy.id}:${provider.id}` },
          update: {},
          create: {
            providerId: provider.id,
            policyVersionId: policy.id,
            event: "POLICY_BECAME_EFFECTIVE",
            actorType: "SYSTEM",
            operationKey: `policy-effective:${policy.id}:${provider.id}`,
          },
        });
        if (
          previousTruth.status !== currentTruth.status ||
          previousTruth.satisfied !== currentTruth.satisfied
        ) {
          await transaction.providerVerificationHistory.upsert({
            where: { operationKey: `policy-truth:${policy.id}:${provider.id}` },
            update: {},
            create: {
              providerId: provider.id,
              policyVersionId: policy.id,
              event: "VERIFICATION_TRUTH_CHANGED",
              actorType: "SYSTEM",
              reasonCode: `${previousTruth.status}_TO_${currentTruth.status}`,
              operationKey: `policy-truth:${policy.id}:${provider.id}`,
            },
          });
        }
        if (previousTruth.badge !== currentTruth.badge) {
          await transaction.providerVerificationHistory.upsert({
            where: { operationKey: `policy-badge:${policy.id}:${provider.id}` },
            update: {},
            create: {
              providerId: provider.id,
              policyVersionId: policy.id,
              event: "BADGE_TRUTH_CHANGED",
              actorType: "SYSTEM",
              reasonCode: `${previousTruth.badge}_TO_${currentTruth.badge}`,
              operationKey: `policy-badge:${policy.id}:${provider.id}`,
            },
          });
        }
      });
    }
    const nextCursor = providers.length === input.limit ? providers.at(-1)?.id ?? null : null;
    const advanced = await this.db.providerPolicyActivationState.updateMany({
      where: { id: activationState.id, version: activationState.version },
      data: { cursor: nextCursor, version: { increment: 1 } },
    });
    if (advanced.count !== 1) throw new Error("POLICY_VERSION_CONFLICT");
    return {
      processed: providers.length,
      nextCursor,
    };
  }
}
