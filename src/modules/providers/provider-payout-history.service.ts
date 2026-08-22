import type { PrismaProviderPayoutRepository } from "./infrastructure/prisma-provider-payout.repository.js";
import { safePayoutHistoryEvent } from "./provider-payout.dto.js";
import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import type { ProviderDenialAuditService } from "./provider-denial-audit.service.js";

export class ProviderPayoutHistoryService {
  public constructor(
    private readonly repository: PrismaProviderPayoutRepository,
    private readonly denialAudit?: ProviderDenialAuditService,
  ) {}
  public async list(principal: AuthenticationPrincipal, providerId: string, input: { readonly limit?: number; readonly cursor?: string } = {}) {
    const provider = await this.repository.readAccess(providerId, principal.userId);
    const member = provider?.members[0];
    if (
      principal.status !== "ACTIVE" ||
      principal.verificationOnly ||
      provider?.applicationStatus !== "APPROVED" ||
      member?.status !== "ACTIVE" ||
      !["OWNER", "ADMIN"].includes(member.level)
    ) {
      if (this.denialAudit !== undefined) {
        return this.denialAudit.denyR1P06({
          actorUserId: principal.userId,
          action: "PROVIDER_PAYOUT_HISTORY_READ",
          targetId: providerId,
          publicErrorCode: "PROVIDER_SCOPE_DENIED",
        });
      }
      throw new Error("PROVIDER_SCOPE_DENIED");
    }
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const cursor = decodeR1P06Cursor(input.cursor, "provider-payout-history");
    const rows = await this.repository.listHistory(providerId, limit + 1, cursor === undefined ? undefined : { createdAt: cursor.at, id: cursor.id });
    const visible = rows.slice(0, limit);
    return { items: visible.map((row) => safePayoutHistoryEvent({
      id: row.id, event: row.event, fromStatus: row.fromStatus, toStatus: row.toStatus,
      actorType: row.actorType, reasonCode: row.reasonCode,
      mask: row.safeMask, exactVersion: row.exactVersion, createdAt: row.createdAt.toISOString(),
    })), nextCursor: rows.length > limit && visible.length > 0 ? encodeR1P06Cursor("provider-payout-history", visible.at(-1)!.createdAt, visible.at(-1)!.id) : null };
  }
}
