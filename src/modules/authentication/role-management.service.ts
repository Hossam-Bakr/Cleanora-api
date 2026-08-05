import type {
  SafeAuditContext,
  SafePrivilegedAuditInput,
} from "#modules/admin/audit.service";

import { AuthorizationService } from "./authorization.service.js";
import type { AuthenticationPrincipal } from "./domain/authentication.types.js";
import { findProtectedOperation } from "./domain/authorization.catalog.js";
import {
  authorizationDenialError,
  authorizationError,
} from "./domain/authorization.errors.js";
import type {
  AuthorizationGrantReader,
  PrivilegedReasonRecord,
  RoleGrantRecord,
} from "./domain/authorization.ports.js";
import type { UserRoleStatus } from "./domain/authorization.types.js";
import type {
  RoleManagementUnitOfWork,
  RoleManagementUnitOfWorkContext,
} from "./role-management.unit-of-work.js";

/** The four privileged role-grant operations R1-P03 supports. */
export type RoleManagementOperation =
  | "assign"
  | "revoke"
  | "enable"
  | "disable";

export interface RoleManagementCommand {
  readonly actor: AuthenticationPrincipal;
  readonly targetUserId: string;
  readonly roleCode: string;
  readonly reasonCode: string;
  readonly requestId?: string;
}

/**
 * Result of one role-management call. It carries business state only: no Prisma
 * row, no audit record, and no before/after payload.
 */
export interface RoleManagementResult {
  readonly targetUserId: string;
  readonly roleCode: string;
  readonly status: UserRoleStatus;
  readonly mutated: boolean;
  readonly auditAppended: boolean;
}

/** Each operation is a declared protected operation with its own reason. */
const OPERATION_IDS: Record<RoleManagementOperation, string> = {
  assign: "identity.roles.assign",
  revoke: "identity.roles.revoke",
  enable: "identity.roles.enable",
  disable: "identity.roles.disable",
};

/** What the transition matrix decided for one call. */
type TransitionPlan =
  | { readonly kind: "MUTATE"; readonly nextStatus: UserRoleStatus }
  | { readonly kind: "NOOP" }
  | { readonly kind: "REJECT" };

const MUTATE_TO_ENABLED: TransitionPlan = {
  kind: "MUTATE",
  nextStatus: "ENABLED",
};
const NOOP: TransitionPlan = { kind: "NOOP" };
const REJECT: TransitionPlan = { kind: "REJECT" };

/**
 * The exact R1-P03 transition matrix.
 *
 * `currentStatus` is `undefined` when the target holds no grant for the role.
 */
function planTransition(
  operation: RoleManagementOperation,
  currentStatus: UserRoleStatus | undefined,
): TransitionPlan {
  if (operation === "assign") {
    if (currentStatus === undefined || currentStatus === "REVOKED") {
      return MUTATE_TO_ENABLED;
    }
    if (currentStatus === "ENABLED") {
      return NOOP;
    }
    // A DISABLED grant is re-activated with enableRole, never with assignRole.
    return REJECT;
  }

  if (operation === "enable") {
    if (currentStatus === "DISABLED") {
      return MUTATE_TO_ENABLED;
    }
    if (currentStatus === "ENABLED") {
      return NOOP;
    }
    return REJECT;
  }

  if (operation === "disable") {
    if (currentStatus === "ENABLED") {
      return { kind: "MUTATE", nextStatus: "DISABLED" };
    }
    if (currentStatus === "DISABLED") {
      return NOOP;
    }
    return REJECT;
  }

  if (currentStatus === "ENABLED" || currentStatus === "DISABLED") {
    return { kind: "MUTATE", nextStatus: "REVOKED" };
  }
  if (currentStatus === "REVOKED") {
    return NOOP;
  }
  return REJECT;
}

/** Reason codes are bound one-to-one to the operation they authorize. */
function isReasonUsableForOperation(
  reason: PrivilegedReasonRecord | null,
  requiredOperation: string,
): boolean {
  if (reason === null) {
    return false;
  }
  return reason.isActive && reason.operation === requiredOperation;
}

/**
 * Safe audit context for a real mutation: business identifiers and the grant
 * status before and after the change. It never carries credentials or tokens.
 */
function buildAuditContext(
  command: RoleManagementCommand,
  statusBefore: UserRoleStatus | undefined,
  statusAfter: UserRoleStatus,
): SafeAuditContext {
  return {
    targetUserId: command.targetUserId,
    roleCode: command.roleCode,
    before: { status: statusBefore ?? "ABSENT" },
    after: { status: statusAfter },
  };
}

/**
 * Internal role-management contract. R1-P03 exposes no public endpoint for it:
 * only a separately authorized caller inside the backend may use this service.
 *
 * Every call opens one unit of work, then validates the actor from
 * transaction-scoped grants, the target, the role, the self-management rule,
 * and the exact active reason before it decides between a real mutation, an
 * authorized no-op, and a rejection. Audit evidence is appended only after a
 * real mutation succeeds, inside the same unit of work, so a failed audit write
 * rolls the mutation back.
 */
export class RoleManagementService {
  private readonly unitOfWork: RoleManagementUnitOfWork;

  constructor(unitOfWork: RoleManagementUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  async assignRole(
    command: RoleManagementCommand,
  ): Promise<RoleManagementResult> {
    return this.runRoleManagement("assign", command);
  }

  async revokeRole(
    command: RoleManagementCommand,
  ): Promise<RoleManagementResult> {
    return this.runRoleManagement("revoke", command);
  }

  async enableRole(
    command: RoleManagementCommand,
  ): Promise<RoleManagementResult> {
    return this.runRoleManagement("enable", command);
  }

  async disableRole(
    command: RoleManagementCommand,
  ): Promise<RoleManagementResult> {
    return this.runRoleManagement("disable", command);
  }

  private async runRoleManagement(
    operation: RoleManagementOperation,
    command: RoleManagementCommand,
  ): Promise<RoleManagementResult> {
    const declaration = findProtectedOperation(OPERATION_IDS[operation]);
    if (declaration?.reasonOperation === undefined) {
      throw authorizationError("AUTHZ_OPERATION_UNKNOWN");
    }
    const operationId = declaration.operationId;
    const requiredReasonOperation = declaration.reasonOperation;

    return this.unitOfWork.run(async (context) => {
      await assertActorMayRunOperation(
        command.actor,
        operationId,
        context.grants,
      );

      if (!(await context.users.exists(command.targetUserId))) {
        throw authorizationError("AUTHZ_TARGET_USER_NOT_FOUND");
      }

      const role = await context.roles.findByCode(command.roleCode);
      if (role === null) {
        throw authorizationError("AUTHZ_ROLE_UNKNOWN");
      }
      if (command.targetUserId === command.actor.userId) {
        throw authorizationError("AUTHZ_SELF_MANAGEMENT_DENIED");
      }

      const reason = await context.reasons.findByCode(command.reasonCode);
      if (!isReasonUsableForOperation(reason, requiredReasonOperation)) {
        throw authorizationError("AUTHZ_REASON_INVALID");
      }

      const currentGrant = await context.grants.findByUserAndRole(
        command.targetUserId,
        role.id,
      );
      const plan = planTransition(operation, currentGrant?.status);

      if (plan.kind === "REJECT") {
        throw authorizationError("AUTHZ_ROLE_TRANSITION_INVALID");
      }
      if (plan.kind === "NOOP") {
        return {
          targetUserId: command.targetUserId,
          roleCode: command.roleCode,
          // A no-op always has a current grant, so this status is the stored one.
          status: currentGrant?.status ?? "ENABLED",
          mutated: false,
          auditAppended: false,
        };
      }

      const mutatedGrant = await applyMutation(context, {
        currentGrant,
        targetUserId: command.targetUserId,
        roleId: role.id,
        nextStatus: plan.nextStatus,
      });

      const auditInput: SafePrivilegedAuditInput = {
        actorType: "USER",
        actorId: command.actor.userId,
        action: operationId,
        targetType: "user_role",
        targetId: mutatedGrant.id,
        reason: command.reasonCode,
        context: buildAuditContext(
          command,
          currentGrant?.status,
          mutatedGrant.status,
        ),
        ...(command.requestId === undefined
          ? {}
          : { requestId: command.requestId }),
      };
      await context.audit.append(auditInput);

      return {
        targetUserId: command.targetUserId,
        roleCode: command.roleCode,
        status: mutatedGrant.status,
        mutated: true,
        auditAppended: true,
      };
    });
  }
}

/**
 * The actor must pass the account-state gate, hold the operation permission,
 * and be allowed to supply a privileged reason. Grants are read from the
 * active unit-of-work context so a concurrent revoke cannot be missed.
 */
async function assertActorMayRunOperation(
  actor: AuthenticationPrincipal,
  operationId: string,
  grants: AuthorizationGrantReader,
): Promise<void> {
  const authorization = new AuthorizationService(grants);

  const operationDecision = await authorization.authorizeProtectedOperation({
    principal: actor,
    operationId,
  });
  if (!operationDecision.allowed) {
    throw authorizationDenialError(operationDecision.denialCode);
  }

  const reasonDecision = await authorization.authorize({
    principal: actor,
    permissionCode: "authz.reasons.use",
  });
  if (!reasonDecision.allowed) {
    throw authorizationError("AUTHZ_REASON_UNAUTHORIZED");
  }
}

/** Create the first grant, or move an existing grant to its next status. */
async function applyMutation(
  context: RoleManagementUnitOfWorkContext,
  mutation: {
    readonly currentGrant: RoleGrantRecord | null;
    readonly targetUserId: string;
    readonly roleId: string;
    readonly nextStatus: UserRoleStatus;
  },
): Promise<RoleGrantRecord> {
  if (mutation.currentGrant === null) {
    return context.grants.createEnabledGrant({
      userId: mutation.targetUserId,
      roleId: mutation.roleId,
    });
  }
  return context.grants.applyStatusTransition({
    grantId: mutation.currentGrant.id,
    nextStatus: mutation.nextStatus,
  });
}
