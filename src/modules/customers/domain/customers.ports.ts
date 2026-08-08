import type { DenialAuditWriter } from "#modules/admin/audit.service";

/** Explicit Admin public contract supplied by composition, never a Prisma writer. */
export interface CustomerDenialAuditPort {
  readonly denialAudit: DenialAuditWriter;
}
