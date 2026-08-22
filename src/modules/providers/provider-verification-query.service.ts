import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import { deriveDocumentVerificationTruth } from "./domain/provider-verification.policy.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import type { PrismaProviderVerificationRepository } from "./infrastructure/prisma-provider-verification.repository.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";
import { mapVerificationOverview } from "./provider-verification.dto.js";

export class ProviderVerificationQueryService {
  public constructor(
    private readonly repository: PrismaProviderVerificationRepository,
    private readonly payoutRepository?: PrismaProviderPayoutRepository,
    private readonly denialAudit?: ProviderDenialAuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async authorize(
    principal: AuthenticationPrincipal,
    providerId: string,
    action: string,
  ) {
    const provider = await this.repository.readProviderAccess(providerId, principal.userId);
    const member = provider?.members[0];
    if (
      principal.status === "ACTIVE" &&
      !principal.verificationOnly &&
      provider?.applicationStatus === "APPROVED" &&
      member?.status === "ACTIVE" &&
      ["OWNER", "ADMIN"].includes(member.level)
    ) return provider;
    if (this.denialAudit !== undefined) {
      return this.denialAudit.denyR1P06({
        actorUserId: principal.userId,
        action,
        targetId: providerId,
        publicErrorCode: "PROVIDER_SCOPE_DENIED",
      });
    }
    throw new Error("PROVIDER_SCOPE_DENIED");
  }

  public async overview(principal: AuthenticationPrincipal, providerId: string) {
    const provider = await this.authorize(principal, providerId, "PROVIDER_VERIFICATION_OVERVIEW_READ");
    const now = this.now();
    const policy = provider.kind === "REGISTERED_COMPANY" && provider.profile?.country !== null && provider.profile?.country !== undefined
      ? await this.repository.readEffectivePolicy({ countryId: provider.profile.country.id, providerKind: "REGISTERED_COMPANY", now })
      : null;
    const effective = await this.repository.listEffectiveDocumentTypeCodes(providerId, now);
    const payoutDestinationReady = await this.payoutRepository?.isPayoutDestinationReady(providerId) ?? false;
    const truth = deriveDocumentVerificationTruth({
      providerKind: provider.kind,
      applicationStatus: provider.applicationStatus,
      effectivePolicyPresent: provider.kind === "INDIVIDUAL_TEAM" || policy !== null,
      requiredTypeCodes: policy?.items.filter((item) => item.isRequired).map((item) => item.documentType.code) ?? [],
      effectiveApprovedTypeCodes: effective,
    });
    return mapVerificationOverview({
      providerId,
      providerKind: provider.kind,
      applicationStatus: provider.applicationStatus,
      operationalStatus: provider.operationalStatus,
      truth,
      payoutDestinationReady,
      capabilities: provider.kind === "INDIVIDUAL_TEAM" ? [] : ["DOCUMENT_READ", "DOCUMENT_WRITE"],
    });
  }

  public async requirements(principal: AuthenticationPrincipal, providerId: string) {
    const provider = await this.authorize(principal, providerId, "PROVIDER_VERIFICATION_REQUIREMENTS_READ");
    if (provider.kind === "INDIVIDUAL_TEAM") {
      return { applicable: false as const, status: "NOT_REQUIRED" as const, requirements: [] };
    }
    const country = provider.profile?.country;
    if (country === null || country === undefined) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    const policy = await this.repository.readEffectivePolicy({ countryId: country.id, providerKind: "REGISTERED_COMPANY", now: this.now() });
    if (policy === null) throw new Error("VERIFICATION_POLICY_NOT_FOUND");
    return {
      applicable: true as const,
      status: "ACTIVE" as const,
      policyVersionId: policy.id,
      policyVersion: policy.policyVersion,
      effectiveAt: policy.effectiveAt?.toISOString() ?? null,
      requirements: policy.items.map((item) => ({
        typeCode: item.documentType.code,
        labelAr: item.documentType.displayNameAr,
        labelEn: item.documentType.displayNameEn,
        required: item.isRequired,
        position: item.position,
        fieldRules: item.fieldRules,
      })),
    };
  }

  public async listDocuments(
    principal: AuthenticationPrincipal,
    providerId: string,
    input: { readonly limit?: number; readonly cursor?: string } = {},
  ) {
    await this.authorize(principal, providerId, "PROVIDER_VERIFICATION_DOCUMENT_LIST");
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "provider-verification-documents");
    const rows = await this.repository.listDocuments({
      providerId,
      limit: limit + 1,
      ...(cursor === undefined ? {} : { cursorUpdatedAt: cursor.at, cursorId: cursor.id }),
    });
    const visible = rows.slice(0, limit);
    const last = visible.at(-1);
    return {
      items: visible.map((row) => ({
        documentVersionId: row.id,
        chainId: row.chainId,
        typeCode: row.chain.documentType.code,
        sequence: row.sequence,
        status: row.status,
        countryCode: row.countryCode,
        issueDate: row.issueDate.toISOString().slice(0, 10),
        expiresAt: row.expiresAt?.toISOString().slice(0, 10) ?? null,
        evidenceFormat: row.evidenceFormat,
        evidenceCount: row.evidence.length,
        effective: row.chain.effectiveVersionId === row.id,
        predecessorVersionId: row.predecessorVersionId,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        submittedAt: row.submittedAt?.toISOString() ?? null,
      })),
      nextCursor: rows.length > limit && last !== undefined
        ? encodeR1P06Cursor("provider-verification-documents", last.updatedAt, last.id)
        : null,
    };
  }
}
