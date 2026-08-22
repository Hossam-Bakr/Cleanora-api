import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import type { PayoutDestinationKind, PayoutDestinationStatus } from "./domain/provider-verification.types.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderPayoutReviewQueryService {
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.payout-destinations.verify") => Promise<boolean>,
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}

  private async authorize(input: {
    readonly actorUserId: string;
    readonly action: string;
    readonly providerId?: string;
    readonly requestId?: string;
  }): Promise<void> {
    if (await this.authorizeStaff(input.actorUserId, "providers.payout-destinations.verify")) return;
    if (this.denialAudit !== undefined) {
      return this.denialAudit.denyR1P06({
        actorUserId: input.actorUserId,
        action: input.action,
        ...(input.providerId === undefined ? {} : { targetId: input.providerId }),
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
        publicErrorCode: "PROVIDER_SCOPE_DENIED",
      });
    }
    throw new Error("PROVIDER_SCOPE_DENIED");
  }

  private mapSafeRow(row: {
    readonly id: string;
    readonly providerId: string;
    readonly kind: PayoutDestinationKind;
    readonly identityClaim: {
      readonly kind: PayoutDestinationKind;
      readonly callingCode: string | null;
      readonly ibanCountryPrefix: string | null;
      readonly lastFour: string;
      readonly identifierLength: number;
    };
    readonly operator: { readonly code: string; readonly labelEn: string } | null;
    readonly bank: { readonly code: string; readonly nameEn: string } | null;
    readonly holderRelationship: "PROVIDER_LEGAL_ENTITY" | "PROVIDER_OWNER";
    readonly status: PayoutDestinationStatus;
    readonly version: number;
    readonly submittedAt: Date | null;
  }) {
    return {
      destinationVersionId: row.id,
      providerId: row.providerId,
      type: row.kind,
      mask: this.repository.safeMask(row.identityClaim),
      institution: row.operator === null
        ? row.bank === null ? null : { code: row.bank.code, label: row.bank.nameEn }
        : { code: row.operator.code, label: row.operator.labelEn },
      holderRelationship: row.holderRelationship,
      status: row.status,
      version: row.version,
      submittedAt: row.submittedAt?.toISOString() ?? null,
    };
  }

  public async listQueue(input: {
    readonly actorUserId: string;
    readonly requestId: string;
    readonly limit?: number;
    readonly cursor?: string;
  }) {
    await this.authorize({ actorUserId: input.actorUserId, action: "STAFF_PAYOUT_DESTINATION_QUEUE_READ", requestId: input.requestId });
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "staff-payout-review-queue");
    const rows = await this.repository.listQueue({
      limit: limit + 1,
      ...(cursor === undefined ? {} : { cursorSubmittedAt: cursor.at, cursorId: cursor.id }),
    });
    const visible = rows.slice(0, limit);
    const last = visible.at(-1);
    return {
      items: visible.map((row) => this.mapSafeRow(row)),
      nextCursor: rows.length > limit && last?.submittedAt !== null && last?.submittedAt !== undefined
        ? encodeR1P06Cursor("staff-payout-review-queue", last.submittedAt, last.id)
        : null,
    };
  }

  public async dossier(input: {
    readonly actorUserId: string;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly requestId: string;
  }) {
    await this.authorize({
      actorUserId: input.actorUserId,
      action: "STAFF_PAYOUT_DESTINATION_DOSSIER_READ",
      providerId: input.providerId,
      requestId: input.requestId,
    });
    const row = await this.repository.read(input.providerId, input.destinationVersionId);
    if (row === null) throw new Error("PAYOUT_DESTINATION_STATE_CONFLICT");
    return {
      ...this.mapSafeRow(row),
      decisions: row.decisions.map((decision) => ({
        decisionId: decision.id,
        outcome: decision.outcome,
        verificationMethod: decision.verificationMethod,
        reasonCode: decision.reasonCode,
        verificationNote: decision.verificationNote,
        actorUserId: decision.actorUserId,
        decidedAt: decision.decidedAt.toISOString(),
        exactVersion: decision.expectedDestinationVersion,
      })),
    };
  }
}
