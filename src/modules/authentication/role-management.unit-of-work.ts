import type { PrivilegedAuditWriter } from "#modules/admin/audit.service";

import type {
  IdentityUserStore,
  PrivilegedReasonStore,
  RoleDefinitionStore,
  RoleGrantStore,
} from "./domain/authorization.ports.js";

/**
 * Everything `RoleManagementService` may touch inside one transaction.
 *
 * Exactly five ports: grants, roles, reasons, users, and audit. The service
 * sees business ports only: no Prisma client, no Prisma transaction, no raw
 * model, and no admin repository. `audit` is the admin-owned writer, so admin
 * stays the only module that maps `audit_logs`.
 *
 * Actor authorization reads enabled grants through `grants` (which also
 * satisfies AuthorizationGrantReader), so permission checks stay inside the
 * same transaction as mutation and audit.
 */
export interface RoleManagementUnitOfWorkContext {
  readonly grants: RoleGrantStore;
  readonly roles: RoleDefinitionStore;
  readonly reasons: PrivilegedReasonStore;
  readonly users: IdentityUserStore;
  readonly audit: PrivilegedAuditWriter;
}

/**
 * Runs one unit of work atomically. The work commits only when it returns
 * normally; any thrown error rolls back every write, including a grant
 * mutation whose audit evidence failed to persist.
 */
export interface RoleManagementUnitOfWork {
  run<T>(
    work: (context: RoleManagementUnitOfWorkContext) => Promise<T>,
  ): Promise<T>;
}
