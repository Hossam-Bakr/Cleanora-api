import type {
  EffectivePermissions,
  PrivilegedOperation,
  UserRoleStatus,
} from "./authorization.types.js";

/**
 * Business-level persistence ports for authorization and role management.
 *
 * These ports never expose a Prisma client, transaction, or model type. The
 * transaction-scoped implementations live in the authentication infrastructure
 * layer and are supplied through the role-management unit of work.
 */

/** One seeded role definition. Definitions have no activation flag. */
export interface RoleDefinitionRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** One user-role grant, described with business fields only. */
export interface RoleGrantRecord {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly status: UserRoleStatus;
  readonly assignedAt: Date;
  readonly enabledAt: Date | null;
  readonly disabledAt: Date | null;
  readonly revokedAt: Date | null;
}

/** One seeded privileged reason definition with its bound operation. */
export interface PrivilegedReasonRecord {
  readonly code: string;
  readonly operation: PrivilegedOperation;
  readonly isActive: boolean;
}

export interface RoleDefinitionStore {
  findByCode(code: string): Promise<RoleDefinitionRecord | null>;
}

export interface PrivilegedReasonStore {
  findByCode(code: string): Promise<PrivilegedReasonRecord | null>;
}

export interface IdentityUserStore {
  exists(userId: string): Promise<boolean>;
}

/**
 * Non-transactional reader used by authorization evaluation. It always reads
 * fresh state so a revoked or disabled grant stops granting access immediately.
 *
 * Inside a role-management unit of work, the same method lives on `grants` so
 * actor authorization uses the transaction-scoped grant store.
 */
export interface AuthorizationGrantReader {
  findEnabledRolesAndPermissions(
    userId: string,
  ): Promise<EffectivePermissions>;
}

export interface RoleGrantStore extends AuthorizationGrantReader {
  findByUserAndRole(
    userId: string,
    roleId: string,
  ): Promise<RoleGrantRecord | null>;
  /** Create the first grant for a user and role in the ENABLED state. */
  createEnabledGrant(input: {
    readonly userId: string;
    readonly roleId: string;
  }): Promise<RoleGrantRecord>;
  /** Move an existing grant to the next status and apply timestamp rules. */
  applyStatusTransition(input: {
    readonly grantId: string;
    readonly nextStatus: UserRoleStatus;
  }): Promise<RoleGrantRecord>;
}
