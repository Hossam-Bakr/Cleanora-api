import type { Prisma } from "#generated/prisma/client";

import {
  assertSafePrivilegedAuditInput,
  toPrismaJsonValue,
  type PrivilegedAuditAck,
  type PrivilegedAuditWriter,
  type SafePrivilegedAuditInput,
} from "../audit.service.js";

/** The only Prisma delegate this factory is allowed to touch. */
export type PrivilegedAuditTransaction = Pick<
  Prisma.TransactionClient,
  "auditLog"
>;

/**
 * Build the admin-owned privileged-audit writer for one active transaction.
 *
 * Admin is the only module that maps and writes `audit_logs`. This factory is
 * infrastructure wiring, not a public module API: composition injects it into
 * the identity unit of work, and no authentication application or domain file
 * may import it.
 */
export function createPrismaPrivilegedAuditWriter(
  transaction: PrivilegedAuditTransaction,
): PrivilegedAuditWriter {
  return {
    async append(
      input: SafePrivilegedAuditInput,
    ): Promise<PrivilegedAuditAck> {
      assertSafePrivilegedAuditInput(input);

      const audit = await transaction.auditLog.create({
        data: {
          actorType: input.actorType,
          ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
          action: input.action,
          targetType: input.targetType,
          ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
          reason: input.reason,
          ...(input.context === undefined
            ? {}
            : { context: toPrismaJsonValue(input.context) }),
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        },
      });

      return { id: audit.id, createdAt: audit.createdAt.toISOString() };
    },
  };
}
