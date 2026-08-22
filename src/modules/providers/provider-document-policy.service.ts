import {
  assertCanPublishDocumentPolicy,
  assertDocumentPolicyDraft,
  assertDocumentPolicyItems,
  type DocumentPolicyItemInput,
} from "./domain/provider-document-policy.policy.js";
import type { PrismaProviderVerificationRepository } from "./infrastructure/prisma-provider-verification.repository.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderDocumentPolicyService {
  public constructor(
    private readonly repository: PrismaProviderVerificationRepository,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.verification.policies.manage") => Promise<boolean>,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}

  private async assertAuthorized(actorUserId: string, action: string): Promise<void> {
    if (await this.authorizeStaff(actorUserId, "providers.verification.policies.manage")) return;
    if (this.denialAudit !== undefined) {
      return this.denialAudit.denyR1P06({
        actorUserId,
        action,
        publicErrorCode: "PROVIDER_SCOPE_DENIED",
      });
    }
    throw new Error("PROVIDER_SCOPE_DENIED");
  }

  public async listTypes(actorUserId: string) {
    await this.assertAuthorized(actorUserId, "STAFF_VERIFICATION_DOCUMENT_TYPE_LIST");
    return this.repository.listDocumentTypes();
  }
  public async list(actorUserId: string, input: { readonly limit?: number; readonly cursor?: string } = {}) {
    await this.assertAuthorized(actorUserId, "STAFF_VERIFICATION_POLICY_LIST");
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "staff-document-policies");
    const rows = await this.repository.listPolicies({ limit: limit + 1, ...(cursor === undefined ? {} : { cursorCreatedAt: cursor.at, cursorId: cursor.id }) });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last !== undefined ? encodeR1P06Cursor("staff-document-policies", last.createdAt, last.id) : null };
  }
  public async createDraft(input: {
    readonly actorUserId: string;
    readonly countryCode: string;
    readonly providerKind: "REGISTERED_COMPANY";
    readonly effectiveAt: Date;
    readonly commandId: string;
    readonly items: readonly DocumentPolicyItemInput[];
  }) {
    await this.assertAuthorized(input.actorUserId, "STAFF_VERIFICATION_POLICY_CREATE");
    assertDocumentPolicyDraft(input);
    return this.repository.createPolicyDraft({ ...input, items: input.items.map((item) => ({ ...item, fieldRules: item.fieldRules as object })) });
  }
  public async publish(input: {
    readonly actorUserId: string;
    readonly policyVersionId: string;
    readonly expectedVersion: number;
    readonly reason: string;
    readonly commandId: string;
  }) {
    await this.assertAuthorized(input.actorUserId, "STAFF_VERIFICATION_POLICY_PUBLISH");
    const replay = await this.repository.findPolicyPublishReplay(input);
    if (replay !== null) return replay;
    const policy = await this.repository.readPolicy(input.policyVersionId);
    if (policy === null) throw new Error("POLICY_VERSION_CONFLICT");
    assertCanPublishDocumentPolicy({ status: policy.status, reason: input.reason, effectiveAt: policy.effectiveAt });
    return this.repository.publishPolicy({ ...input, now: this.now() });
  }

  public async replaceDraft(input: {
    readonly actorUserId: string;
    readonly policyVersionId: string;
    readonly expectedVersion: number;
    readonly effectiveAt: Date;
    readonly commandId: string;
    readonly items: readonly DocumentPolicyItemInput[];
  }) {
    await this.assertAuthorized(input.actorUserId, "STAFF_VERIFICATION_POLICY_REPLACE");
    if (Number.isNaN(input.effectiveAt.getTime())) throw new Error("VALIDATION_ERROR");
    assertDocumentPolicyItems(input.items);
    return this.repository.replacePolicyDraft({
      ...input,
      items: input.items.map((item) => ({ ...item, fieldRules: item.fieldRules as object })),
    });
  }
}
