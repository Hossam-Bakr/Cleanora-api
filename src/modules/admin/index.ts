import type { ModuleRegistrar } from "#routes/register-modules";

import { writeAudit as writeWithRepository } from "./application/write-audit.js";
import type { AuditRecord, WriteAuditInput } from "./domain/audit.types.js";
import { AuditLogRepository } from "./infrastructure/audit-log.repository.js";

const auditLogRepository = new AuditLogRepository();

export type { AuditActorType, AuditRecord, WriteAuditInput } from "./domain/audit.types.js";

export async function writeAudit(input: WriteAuditInput): Promise<AuditRecord> {
  return writeWithRepository(auditLogRepository, input);
}

/**
 * @desc Identify the admin audit module at application composition time.
 * @access Public module entry
 * @explanation R1-P01 creates only the audit foundation, so it registers no
 * admin HTTP endpoints before authorization exists.
 */
export const adminModuleRegistrar: ModuleRegistrar = {
  name: "admin",
  register: () => undefined
};
