import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import { AppError } from "#shared/errors/app-error";

export type AuditActorType = "USER" | "SYSTEM" | "UNKNOWN";

/** JSON values safe to store in audit context (no functions, dates, or null). */
export type SafeJsonPrimitive = string | number | boolean;
export type SafeJsonValue =
  | SafeJsonPrimitive
  | readonly SafeJsonValue[]
  | { readonly [key: string]: SafeJsonValue };

/** Object form of audit context passed through privileged writes. */
export type SafeAuditContext = { readonly [key: string]: SafeJsonValue };

export interface WriteAuditInput {
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly context?: SafeAuditContext;
  readonly requestId?: string;
}

export interface AuditRecord extends WriteAuditInput {
  readonly id: string;
  readonly createdAt: string;
}

export interface AuditWriter {
  append(input: WriteAuditInput): Promise<AuditRecord>;
}

/**
 * Privileged-audit evidence for one completed privileged write. `reason` is
 * required because a privileged write always carries an approved reason code,
 * and `context` may hold safe before/after state only.
 */
export interface SafePrivilegedAuditInput extends WriteAuditInput {
  readonly reason: string;
}

/** Acknowledgement returned to the calling module. Carries no audit payload. */
export interface PrivilegedAuditAck {
  readonly id: string;
  readonly createdAt: string;
}

/**
 * Business-level writer other modules use to append privileged evidence.
 * It exposes no Prisma client, transaction, or model type.
 */
export interface PrivilegedAuditWriter {
  append(input: SafePrivilegedAuditInput): Promise<PrivilegedAuditAck>;
}

/** Acknowledgement for a general transactional audit append inside a business TX. */
export interface GeneralTransactionalAuditAck {
  readonly id: string;
  readonly createdAt: string;
}

/** Transaction-scoped writer for ordinary FR-033 mutations (no privileged reason). */
export interface GeneralTransactionalAuditWriter {
  append(input: WriteAuditInput): Promise<GeneralTransactionalAuditAck>;
}

/** Security-relevant denial evidence when no business mutation commits. */
export interface SafeDenialAuditInput extends WriteAuditInput {
  readonly outcome: string;
}

export interface DenialAuditAck {
  readonly id: string;
  readonly createdAt: string;
}

/** Non-transactional writer for ownership-safe and ineligible denials. */
export interface DenialAuditWriter {
  append(input: SafeDenialAuditInput): Promise<DenialAuditAck>;
}

const protectedContentKeyPattern =
  /(address|email|phone|image|profile|street|postal|export|contact|fullName|displayName)/iu;

function containsProtectedContentKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsProtectedContentKey);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      protectedContentKeyPattern.test(key) ||
      containsProtectedContentKey(nestedValue),
  );
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

function auditInputInvalid(): AppError {
  return new AppError({
    code: "AUDIT_INPUT_INVALID",
    message: "Audit input is invalid",
    statusCode: 400,
  });
}

/**
 * Reject audit evidence that is incomplete or carries secret-like context.
 * Every audit writer, transactional or not, runs this same check.
 */
export function assertSafeAuditInput(input: WriteAuditInput): void {
  if (
    input.action.trim().length === 0 ||
    input.targetType.trim().length === 0 ||
    containsSecretLikeKey(input.context)
  ) {
    throw auditInputInvalid();
  }
}

/** Denial evidence must name the outcome and exclude protected personal payloads. */
export function assertSafeDenialAuditInput(input: SafeDenialAuditInput): void {
  assertSafeAuditInput(input);
  if (input.outcome.trim().length === 0) {
    throw auditInputInvalid();
  }
  if (containsProtectedContentKey(input.context)) {
    throw auditInputInvalid();
  }
}

/** Privileged evidence must also name the approved reason for the write. */
export function assertSafePrivilegedAuditInput(
  input: SafePrivilegedAuditInput,
): void {
  assertSafeAuditInput(input);
  if (input.reason.trim().length === 0) {
    throw auditInputInvalid();
  }
}

/**
 * Validate and append audit evidence. Persistence failures intentionally
 * escape so auditable operations cannot silently lose their evidence.
 */
export async function writeAuditWith(
  writer: AuditWriter,
  input: WriteAuditInput,
): Promise<AuditRecord> {
  assertSafeAuditInput(input);
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
          : { context: toPrismaJsonValue(input.context) }),
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
        : { context: readAuditContext(audit.context) }),
      ...(audit.requestId === null ? {} : { requestId: audit.requestId }),
      createdAt: audit.createdAt.toISOString(),
    };
  },
};

/**
 * Copy a safe business JSON value into Prisma's JSON input shape without a
 * type assertion. Null is intentionally excluded from SafeJsonValue.
 */
export function toPrismaJsonValue(value: SafeJsonValue): Prisma.InputJsonValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const items: Prisma.InputJsonValue[] = [];
    for (const item of value) {
      items.push(toPrismaJsonValue(item));
    }
    return items;
  }
  const result: { [key: string]: Prisma.InputJsonValue } = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = toPrismaJsonValue(nested);
  }
  return result;
}

function isJsonObject(
  value: Prisma.JsonValue,
): value is { readonly [key: string]: Prisma.JsonValue | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAuditContext(value: Prisma.JsonValue): SafeAuditContext {
  if (!isJsonObject(value)) {
    return {};
  }
  return copyJsonObject(value);
}

function copyJsonValue(value: Prisma.JsonValue): SafeJsonValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const items: SafeJsonValue[] = [];
    for (const item of value) {
      const copied = copyJsonValue(item);
      if (copied !== undefined) {
        items.push(copied);
      }
    }
    return items;
  }
  return copyJsonObject(value);
}

function copyJsonObject(value: {
  readonly [key: string]: Prisma.JsonValue | undefined;
}): SafeAuditContext {
  const result: { [key: string]: SafeJsonValue } = {};
  for (const key of Object.keys(value)) {
    const nested = value[key];
    if (nested === undefined) {
      continue;
    }
    const copied = copyJsonValue(nested);
    if (copied === undefined) {
      continue;
    }
    result[key] = copied;
  }
  return result;
}

export async function writeAudit(input: WriteAuditInput): Promise<AuditRecord> {
  return writeAuditWith(databaseWriter, input);
}
