import { AppError } from "#core/errors/app-error";

import type {
  AuditLogWriter,
  AuditRecord,
  WriteAuditInput
} from "../domain/audit.types.js";

const secretKeyPattern = /(secret|password|credential|token|api[_-]?key|cookie|otp)/i;

/**
 * Validate and append audit evidence. Persistence errors intentionally escape
 * so callers can abort auditable work rather than losing required evidence.
 */
export async function writeAudit(
  writer: AuditLogWriter,
  input: WriteAuditInput
): Promise<AuditRecord> {
  if (
    input.action.trim().length === 0 ||
    input.targetType.trim().length === 0 ||
    containsSecretLikeKey(input.context)
  ) {
    throw new AppError({
      code: "AUDIT_INPUT_INVALID",
      message: "Audit input is invalid",
      statusCode: 400
    });
  }

  return writer.append(input);
}

function containsSecretLikeKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSecretLikeKey);
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(
    ([key, nestedValue]) =>
      secretKeyPattern.test(key) || containsSecretLikeKey(nestedValue)
  );
}
