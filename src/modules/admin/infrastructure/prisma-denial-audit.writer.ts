import { getPrismaClient } from "#database/prisma";

import {
  assertSafeDenialAuditInput,
  toPrismaJsonValue,
  type DenialAuditAck,
  type DenialAuditWriter,
  type SafeDenialAuditInput,
} from "../audit.service.js";

/**
 * Build the admin-owned safe non-transactional denial audit writer.
 *
 * Security-relevant denials may append evidence outside a business transaction
 * because no customer mutation is committed.
 */
export function createPrismaDenialAuditWriter(): DenialAuditWriter {
  return {
    async append(input: SafeDenialAuditInput): Promise<DenialAuditAck> {
      assertSafeDenialAuditInput(input);

      const audit = await getPrismaClient().auditLog.create({
        data: {
          actorType: input.actorType,
          ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
          action: input.action,
          targetType: input.targetType,
          ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          context: toPrismaJsonValue({
            outcome: input.outcome,
            ...(input.context ?? {}),
          }),
          ...(input.requestId === undefined
            ? {}
            : { requestId: input.requestId }),
        },
      });

      return { id: audit.id, createdAt: audit.createdAt.toISOString() };
    },
  };
}
