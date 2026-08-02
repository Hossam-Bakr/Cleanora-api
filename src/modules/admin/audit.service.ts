import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import { AppError } from "#shared/errors/app-error";

export type AuditActorType = "USER" | "SYSTEM" | "UNKNOWN";

export interface WriteAuditInput {
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly context?: Record<string, unknown>;
  readonly requestId?: string;
}

export interface AuditRecord extends WriteAuditInput {
  readonly id: string;
  readonly createdAt: string;
}

export interface AuditWriter {
  append(input: WriteAuditInput): Promise<AuditRecord>;
}

const secretKeyPattern =
  /(secret|password|credential|token|api[_-]?key|cookie|otp)/iu;

function containsSecretLikeKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSecretLikeKey);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      secretKeyPattern.test(key) || containsSecretLikeKey(nestedValue),
  );
}

/**
 * Validate and append audit evidence. Persistence failures intentionally
 * escape so auditable operations cannot silently lose their evidence.
 */
export async function writeAuditWith(
  writer: AuditWriter,
  input: WriteAuditInput,
): Promise<AuditRecord> {
  if (
    input.action.trim().length === 0 ||
    input.targetType.trim().length === 0 ||
    containsSecretLikeKey(input.context)
  ) {
    throw new AppError({
      code: "AUDIT_INPUT_INVALID",
      message: "Audit input is invalid",
      statusCode: 400,
    });
  }
  return writer.append(input);
}

const databaseWriter: AuditWriter = {
  async append(input): Promise<AuditRecord> {
    const audit = await getPrismaClient().auditLog.create({
      data: {
        actorType: input.actorType,
        ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
        action: input.action,
        targetType: input.targetType,
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        ...(input.context === undefined
          ? {}
          : { context: input.context as Prisma.InputJsonValue }),
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      },
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
      createdAt: audit.createdAt.toISOString(),
    };
  },
};

export async function writeAudit(input: WriteAuditInput): Promise<AuditRecord> {
  return writeAuditWith(databaseWriter, input);
}
