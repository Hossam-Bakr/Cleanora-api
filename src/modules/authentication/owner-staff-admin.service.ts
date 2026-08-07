import { timingSafeEqual } from "node:crypto";

import type { PrivilegedAuditWriter } from "#modules/admin/audit.service";
import { AppError } from "#shared/errors/app-error";

import type {
  RoleDefinitionStore,
  RoleGrantStore,
} from "./domain/authorization.ports.js";

export const OWNER_STAFF_ADMIN_REASON = "owner_staff_admin_provision";
export const OWNER_STAFF_ADMIN_ROLE = "staff_admin";

export type OwnerStaffAdminOutcome =
  | "CREATED"
  | "RE_ENABLED"
  | "ALREADY_ENABLED";

export interface OwnerStaffAdminProvisionResult {
  readonly outcome: OwnerStaffAdminOutcome;
  readonly targetUserId: string;
  readonly roleCode: "staff_admin";
  readonly grantStatus: "ENABLED";
}

/** Minimal user facts for owner staff_admin provisioning. */
export interface OwnerProvisionTarget {
  readonly userId: string;
  readonly status: "ACTIVE" | "SUSPENDED" | "BANNED";
  readonly emailVerified: boolean;
}

export interface OwnerStaffAdminUnitOfWorkContext {
  readonly findTargetByEmail: (
    emailNormalized: string,
  ) => Promise<OwnerProvisionTarget | null>;
  readonly grants: RoleGrantStore;
  readonly roles: RoleDefinitionStore;
  readonly audit: PrivilegedAuditWriter;
}

export interface OwnerStaffAdminUnitOfWork {
  run<T>(
    work: (context: OwnerStaffAdminUnitOfWorkContext) => Promise<T>,
  ): Promise<T>;
}

export interface OwnerStaffAdminProvisionConfig {
  readonly enabled: boolean;
  readonly secret: string | undefined;
}

/**
 * Compare the presented owner secret with the configured secret.
 * Uses timing-safe equality and never logs either value.
 */
export function ownerAdminSecretMatches(
  presented: string | undefined,
  configured: string | undefined,
): boolean {
  if (presented === undefined || configured === undefined) {
    return false;
  }
  const left = Buffer.from(presented);
  const right = Buffer.from(configured);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function denial(message: string): AppError {
  return new AppError({
    code: "OWNER_STAFF_ADMIN_REJECTED",
    message,
    statusCode: 403,
    expose: true,
  });
}

/**
 * Temporarily enabled owner API: assign or re-enable staff_admin only.
 * No other role, operation, or reason is accepted from the client.
 */
export class OwnerStaffAdminProvisionService {
  constructor(
    private readonly config: OwnerStaffAdminProvisionConfig,
    private readonly unitOfWork: OwnerStaffAdminUnitOfWork,
  ) {}

  async provision(input: {
    readonly email: string;
    readonly presentedSecret: string | undefined;
    readonly requestId?: string;
  }): Promise<OwnerStaffAdminProvisionResult> {
    if (!this.config.enabled) {
      throw denial("Owner staff-admin provisioning is disabled.");
    }
    if (!ownerAdminSecretMatches(input.presentedSecret, this.config.secret)) {
      throw denial("Owner staff-admin provisioning was rejected.");
    }

    const emailNormalized = normalizeEmail(input.email);

    return this.unitOfWork.run(async (context) => {
      const target = await context.findTargetByEmail(emailNormalized);
      if (
        target === null ||
        target.status !== "ACTIVE" ||
        !target.emailVerified
      ) {
        throw denial("Owner staff-admin provisioning was rejected.");
      }

      const role = await context.roles.findByCode(OWNER_STAFF_ADMIN_ROLE);
      if (role === null) {
        throw denial("Owner staff-admin provisioning was rejected.");
      }

      const existing = await context.grants.findByUserAndRole(
        target.userId,
        role.id,
      );

      if (existing?.status === "ENABLED") {
        return {
          outcome: "ALREADY_ENABLED" as const,
          targetUserId: target.userId,
          roleCode: "staff_admin" as const,
          grantStatus: "ENABLED" as const,
        };
      }

      let grantId: string;
      let outcome: OwnerStaffAdminOutcome;
      if (existing === null) {
        const created = await context.grants.createEnabledGrant({
          userId: target.userId,
          roleId: role.id,
        });
        grantId = created.id;
        outcome = "CREATED";
      } else {
        const enabled = await context.grants.applyStatusTransition({
          grantId: existing.id,
          nextStatus: "ENABLED",
        });
        grantId = enabled.id;
        outcome = "RE_ENABLED";
      }

      await context.audit.append({
        actorType: "SYSTEM",
        action: "identity.roles.owner_provision_staff_admin",
        targetType: "user_role",
        targetId: grantId,
        reason: OWNER_STAFF_ADMIN_REASON,
        context: {
          roleCode: OWNER_STAFF_ADMIN_ROLE,
          outcome,
          transition: existing === null ? "ABSENT_TO_ENABLED" : "TO_ENABLED",
        },
        ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      });

      return {
        outcome,
        targetUserId: target.userId,
        roleCode: "staff_admin" as const,
        grantStatus: "ENABLED" as const,
      };
    });
  }
}
