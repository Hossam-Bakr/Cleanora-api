import type { PayoutDestinationKind } from "./domain/provider-verification.types.js";
import { isMeaningfulSafeNote } from "./domain/provider-verification.catalog.js";
import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderPayoutConflictService {
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly authorizeStaff: (actorUserId: string, permission: "providers.payout-destinations.verify") => Promise<boolean>,
    private readonly now: () => Date = () => new Date(),
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}
  public record(input: {
    readonly providerId: string; readonly commandId: string; readonly kind: PayoutDestinationKind;
    readonly safeMask: string; readonly incumbentClaimId: string; readonly actorUserId: string; readonly requestId: string;
  }) {
    return this.repository.recordConflict(input);
  }
  public async list(actorUserId: string, input: { readonly limit?: number; readonly cursor?: string } = {}) {
    if (!(await this.authorizeStaff(actorUserId, "providers.payout-destinations.verify"))) {
      if (this.denialAudit !== undefined) return this.denialAudit.denyR1P06({ actorUserId, action: "STAFF_PAYOUT_CONFLICT_QUEUE_READ", publicErrorCode: "PROVIDER_SCOPE_DENIED" });
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "staff-payout-conflicts");
    const rows = await this.repository.listOpenConflicts({ limit: limit + 1, ...(cursor === undefined ? {} : { cursorOpenedAt: cursor.at, cursorId: cursor.id }) });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last !== undefined ? encodeR1P06Cursor("staff-payout-conflicts", last.openedAt, last.id) : null };
  }
  public async resolve(input: {
    readonly actorUserId: string; readonly conflictId: string; readonly providerId: string;
    readonly expectedVersion: number; readonly outcome: "CANDIDATE_REJECTED" | "RESOLVED_AFTER_RELEASE";
    readonly reason: string; readonly commandId: string; readonly requestId: string;
  }) {
    if (!(await this.authorizeStaff(input.actorUserId, "providers.payout-destinations.verify"))) {
      if (this.denialAudit !== undefined) return this.denialAudit.denyR1P06({ actorUserId: input.actorUserId, action: "STAFF_PAYOUT_CONFLICT_RESOLUTION", targetId: input.providerId, requestId: input.requestId, publicErrorCode: "PROVIDER_SCOPE_DENIED" });
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    if (!isMeaningfulSafeNote(input.reason)) throw new Error("VALIDATION_ERROR");
    return this.repository.resolveConflict({ ...input, now: this.now() });
  }
}
