import type { SafePrivilegedAuditInput } from "../../../src/modules/admin/audit.service.js";
import { assertSafePrivilegedAuditInput } from "../../../src/modules/admin/audit.service.js";
import {
  AUTHORIZATION_ROLES,
  PRIVILEGED_ACTION_REASONS,
  permissionCodesForRole,
} from "../../../src/modules/authentication/domain/authorization.catalog.js";
import type { RoleGrantRecord } from "../../../src/modules/authentication/domain/authorization.ports.js";
import type { UserRoleStatus } from "../../../src/modules/authentication/domain/authorization.types.js";
import type {
  RoleManagementUnitOfWork,
  RoleManagementUnitOfWorkContext,
} from "../../../src/modules/authentication/role-management.unit-of-work.js";

export interface FakeGrantSeed {
  readonly userId: string;
  readonly roleCode: string;
  readonly status: UserRoleStatus;
}

export interface FakeRoleManagementWorldOptions {
  readonly existingUserIds?: readonly string[];
  readonly grants?: readonly FakeGrantSeed[];
  /**
   * ENABLED roles for actor-1 used by transaction-scoped authorization.
   * Defaults to `staff_admin` so ordinary mutation tests stay concise.
   */
  readonly actorRoles?: readonly string[];
  /** Reason codes to treat as deactivated, to prove inactive reasons deny. */
  readonly inactiveReasonCodes?: readonly string[];
  /** Simulate an audit persistence failure after a successful mutation. */
  readonly failAuditAppend?: boolean;
  /**
   * When true, revoke actor-1's staff_admin grant as soon as `run` starts so
   * in-transaction authorization sees a stale outside allow as insufficient.
   */
  readonly revokeActorStaffAdminOnRunStart?: boolean;
}

export interface FakeRoleManagementWorld {
  readonly unitOfWork: RoleManagementUnitOfWork;
  readonly auditAppends: readonly SafePrivilegedAuditInput[];
  /** Committed grant status, or `undefined` when the grant does not exist. */
  grantStatus(userId: string, roleCode: string): UserRoleStatus | undefined;
  grantTimestamps(userId: string, roleCode: string): RoleGrantRecord | undefined;
}

function roleIdForCode(roleCode: string): string {
  return `role-${roleCode}`;
}

function roleCodeForId(roleId: string): string {
  return roleId.slice("role-".length);
}

function grantKey(userId: string, roleId: string): string {
  return `${userId}::${roleId}`;
}

/** Same timestamp rules the Prisma grant store applies for a transition. */
function applyTimestampRules(
  grant: RoleGrantRecord,
  nextStatus: UserRoleStatus,
  now: Date,
): RoleGrantRecord {
  if (nextStatus === "ENABLED") {
    return {
      ...grant,
      status: nextStatus,
      enabledAt: now,
      disabledAt: null,
      revokedAt: null,
    };
  }
  if (nextStatus === "DISABLED") {
    return { ...grant, status: nextStatus, disabledAt: now };
  }
  return { ...grant, status: nextStatus, revokedAt: now };
}

class AuditAppendFailure extends Error {
  constructor() {
    super("audit append failed");
    this.name = "AuditAppendFailure";
  }
}

function mergeGrantSeeds(
  seeds: readonly FakeGrantSeed[],
): FakeGrantSeed[] {
  const byKey = new Map<string, FakeGrantSeed>();
  for (const seed of seeds) {
    byKey.set(`${seed.userId}::${seed.roleCode}`, seed);
  }
  return [...byKey.values()];
}

/**
 * In-memory role-management world for unit tests.
 *
 * It mirrors the real unit of work closely enough to prove workflow rules:
 * grants live in a map, roles and reasons come from the seeded catalog, and a
 * thrown error inside `run` discards every change, exactly like a rollback.
 */
export function createFakeRoleManagementWorld(
  options: FakeRoleManagementWorldOptions = {},
): FakeRoleManagementWorld {
  const knownUserIds = new Set(
    options.existingUserIds ?? ["actor-1", "target-1"],
  );
  const inactiveReasonCodes = new Set(options.inactiveReasonCodes ?? []);
  const auditAppends: SafePrivilegedAuditInput[] = [];
  const actorRoles = options.actorRoles ?? ["staff_admin"];

  let grants = new Map<string, RoleGrantRecord>();
  let nextGrantNumber = 1;

  const seeds = mergeGrantSeeds([
    ...actorRoles.map(
      (roleCode): FakeGrantSeed => ({
        userId: "actor-1",
        roleCode,
        status: "ENABLED",
      }),
    ),
    ...(options.grants ?? []),
  ]);

  for (const seed of seeds) {
    const roleId = roleIdForCode(seed.roleCode);
    const now = new Date("2026-01-01T00:00:00.000Z");
    grants.set(grantKey(seed.userId, roleId), {
      id: `grant-${nextGrantNumber++}`,
      userId: seed.userId,
      roleId,
      status: seed.status,
      assignedAt: now,
      enabledAt: seed.status === "ENABLED" ? now : null,
      disabledAt: seed.status === "DISABLED" ? now : null,
      revokedAt: seed.status === "REVOKED" ? now : null,
    });
  }

  function buildContext(
    workingGrants: Map<string, RoleGrantRecord>,
  ): RoleManagementUnitOfWorkContext {
    return {
      grants: {
        async findByUserAndRole(userId, roleId) {
          return workingGrants.get(grantKey(userId, roleId)) ?? null;
        },
        async createEnabledGrant({ userId, roleId }) {
          const now = new Date();
          const created: RoleGrantRecord = {
            id: `grant-${nextGrantNumber++}`,
            userId,
            roleId,
            status: "ENABLED",
            assignedAt: now,
            enabledAt: now,
            disabledAt: null,
            revokedAt: null,
          };
          workingGrants.set(grantKey(userId, roleId), created);
          return created;
        },
        async applyStatusTransition({ grantId, nextStatus }) {
          for (const [key, grant] of workingGrants) {
            if (grant.id !== grantId) {
              continue;
            }
            const updated = applyTimestampRules(grant, nextStatus, new Date());
            workingGrants.set(key, updated);
            return updated;
          }
          throw new Error(`unknown grant ${grantId}`);
        },
        async findEnabledRolesAndPermissions(userId) {
          const roleCodes: string[] = [];
          const permissionCodes = new Set<string>();
          for (const grant of workingGrants.values()) {
            if (grant.userId !== userId || grant.status !== "ENABLED") {
              continue;
            }
            const roleCode = roleCodeForId(grant.roleId);
            roleCodes.push(roleCode);
            for (const permissionCode of permissionCodesForRole(roleCode)) {
              permissionCodes.add(permissionCode);
            }
          }
          return {
            roleCodes,
            permissionCodes: [...permissionCodes],
          };
        },
      },
      roles: {
        async findByCode(code) {
          const role = AUTHORIZATION_ROLES.find(
            (candidate) => candidate.code === code,
          );
          return role === undefined
            ? null
            : { id: roleIdForCode(role.code), code: role.code, name: role.name };
        },
      },
      reasons: {
        async findByCode(code) {
          const reason = PRIVILEGED_ACTION_REASONS.find(
            (candidate) => candidate.code === code,
          );
          if (reason === undefined) {
            return null;
          }
          return {
            code: reason.code,
            operation: reason.operation,
            isActive: !inactiveReasonCodes.has(reason.code),
          };
        },
      },
      users: {
        async exists(userId) {
          return knownUserIds.has(userId);
        },
      },
      audit: {
        async append(input) {
          assertSafePrivilegedAuditInput(input);
          if (options.failAuditAppend === true) {
            throw new AuditAppendFailure();
          }
          auditAppends.push(input);
          return {
            id: `audit-${auditAppends.length}`,
            createdAt: new Date().toISOString(),
          };
        },
      },
    };
  }

  const unitOfWork: RoleManagementUnitOfWork = {
    async run(work) {
      const workingGrants = new Map(grants);
      if (options.revokeActorStaffAdminOnRunStart === true) {
        const key = grantKey("actor-1", roleIdForCode("staff_admin"));
        const existing = workingGrants.get(key);
        if (existing !== undefined) {
          workingGrants.set(key, {
            ...existing,
            status: "REVOKED",
            revokedAt: new Date(),
          });
        }
      }
      const result = await work(buildContext(workingGrants));
      grants = workingGrants;
      return result;
    },
  };

  return {
    unitOfWork,
    auditAppends,
    grantStatus(userId, roleCode) {
      return grants.get(grantKey(userId, roleIdForCode(roleCode)))?.status;
    },
    grantTimestamps(userId, roleCode) {
      return grants.get(grantKey(userId, roleIdForCode(roleCode)));
    },
  };
}
