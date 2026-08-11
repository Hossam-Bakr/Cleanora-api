/**
 * Approved public audit surface for cross-module consumers.
 * Re-exports business-neutral general transactional and denial audit contracts.
 * Infrastructure Prisma factories stay composed at the application root —
 * Providers and other modules must never import `admin/infrastructure/*`.
 */
export const ADMIN_AUDIT_PUBLIC_CONTRACT = "admin.audit.public" as const;

export type {
  AuditActorType,
  DenialAuditAck,
  DenialAuditWriter,
  GeneralTransactionalAuditAck,
  GeneralTransactionalAuditWriter,
  PrivilegedAuditWriter,
  SafeAuditContext,
  SafeDenialAuditInput,
  SafeJsonPrimitive,
  SafeJsonValue,
  WriteAuditInput,
} from "./audit.service.js";

export {
  assertSafeAuditInput,
  assertSafeDenialAuditInput,
} from "./audit.service.js";
