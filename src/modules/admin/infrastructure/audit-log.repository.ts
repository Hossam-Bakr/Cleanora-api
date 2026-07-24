import { getPrismaClient } from "#integrations/database/prisma-client-accessor";

import type {
  AuditLogWriter,
  AuditRecord,
  WriteAuditInput
} from "../domain/audit.types.js";

/**
 * Append audit evidence. This repository deliberately exposes no mutation APIs.
 */
export class AuditLogRepository implements AuditLogWriter {
  async append(input: WriteAuditInput): Promise<AuditRecord> {
    const audit = await getPrismaClient().auditLog.create({
      data: {
        actorType: input.actorType,
        ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
        action: input.action,
        targetType: input.targetType,
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        ...(input.context === undefined ? {} : { context: input.context }),
        ...(input.requestId === undefined ? {} : { requestId: input.requestId })
      }
    });

    return {
      id: audit.id,
      actorType: audit.actorType,
      ...(audit.actorId === null ? {} : { actorId: audit.actorId }),
      action: audit.action,
      targetType: audit.targetType,
      ...(audit.targetId === null ? {} : { targetId: audit.targetId }),
      ...(audit.reason === null ? {} : { reason: audit.reason }),
      ...(audit.context === null
        ? {}
        : { context: audit.context as Record<string, unknown> }),
      ...(audit.requestId === null ? {} : { requestId: audit.requestId }),
      createdAt: audit.createdAt.toISOString()
    };
  }
}
