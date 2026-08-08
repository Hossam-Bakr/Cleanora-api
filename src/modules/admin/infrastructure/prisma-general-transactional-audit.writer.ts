import type { Prisma } from "#generated/prisma/client";

import {
  assertSafeAuditInput,
  toPrismaJsonValue,
  type GeneralTransactionalAuditAck,
  type GeneralTransactionalAuditWriter,
  type WriteAuditInput,
} from "../audit.service.js";

/** The only Prisma delegate this factory is allowed to touch. */
export type GeneralTransactionalAuditTransaction = Pick<
  Prisma.TransactionClient,
  "auditLog"
>;

/**
 * Build the admin-owned general transactional audit writer for one active
 * customers transaction. Ordinary FR-033 mutations use this writer; it does
 * not require a privileged reason.
 */
export function createPrismaGeneralTransactionalAuditWriter(
  transaction: GeneralTransactionalAuditTransaction,
): GeneralTransactionalAuditWriter {
  return {
    async append(input: WriteAuditInput): Promise<GeneralTransactionalAuditAck> {
      assertSafeAuditInput(input);

      const audit = await transaction.auditLog.create({
        data: {
          actorType: input.actorType,
          ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
          action: input.action,
          targetType: input.targetType,
          ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
          ...(input.reason === undefined ? {} : { reason: input.reason }),
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
