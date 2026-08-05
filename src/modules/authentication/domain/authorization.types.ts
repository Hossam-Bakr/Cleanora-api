import type { AuthenticationPrincipal } from "./authentication.types.js";

/** Lifecycle of one user-role grant. Only ENABLED grants give permissions. */
export type UserRoleStatus = "ENABLED" | "DISABLED" | "REVOKED";

/** Operations that require an approved privileged reason (FR-026). */
export type PrivilegedOperation =
  | "ROLE_ASSIGN"
  | "ROLE_REVOKE"
  | "ROLE_ENABLE"
  | "ROLE_DISABLE"
  | "STAFF_SAMPLE_PRIVILEGED_WRITE";

/** Ownership rule a protected operation requires. */
export type OwnershipRule = "NONE" | "SELF";

/** Scope rule a protected operation requires. */
export type ScopeRule = "NONE" | "GLOBAL" | "PROVIDER" | "WORKER";

/** Stable denial reasons. Safe to assert in tests and safe to log. */
export type AuthorizationDenialCode =
  | "ACCOUNT_STATE_DENIED"
  | "PERMISSION_DENIED"
  | "OWNERSHIP_DENIED"
  | "SCOPE_DENIED"
  | "RESOURCE_STATE_DENIED";

export interface RoleDefinitionSeed {
  readonly code: string;
  readonly name: string;
}

export interface PermissionDefinitionSeed {
  readonly code: string;
  readonly name: string;
}

export interface PrivilegedActionReasonSeed {
  readonly code: string;
  readonly name: string;
  readonly operation: PrivilegedOperation;
  readonly isActive: boolean;
}

/**
 * One R1-P03 protected operation. Every declaration is internal:
 * `publicHttp` is always false because R1-P03 exposes no public endpoint.
 */
export interface ProtectedOperationDeclaration {
  readonly operationId: string;
  readonly permissionCode: string;
  readonly ownership: OwnershipRule;
  readonly scope: ScopeRule;
  readonly privileged: boolean;
  readonly reasonOperation?: PrivilegedOperation;
  readonly publicHttp: false;
}

/** Server-established ownership fact. Never accepted from a client. */
export interface SelfOwnershipFact {
  readonly type: "SELF";
  readonly resourceOwnerUserId: string;
}

export type OwnershipFact = SelfOwnershipFact;

export interface GlobalScopeFact {
  readonly kind: "GLOBAL";
}

/**
 * Provider scope fact. `memberProviderId` is the real membership record.
 * Provider membership does not exist yet, so production callers cannot supply
 * it and every provider-scoped decision denies. Tests supply synthetic facts.
 */
export interface ProviderScopeFact {
  readonly kind: "PROVIDER";
  readonly requestedProviderId: string;
  readonly memberProviderId?: string;
}

/**
 * Worker scope fact. `workerRecordUserId` is the real worker record, which
 * does not exist yet, so production worker-scoped decisions deny.
 */
export interface WorkerScopeFact {
  readonly kind: "WORKER";
  readonly requestedWorkerUserId: string;
  readonly workerRecordUserId?: string;
}

export type ScopeFact = GlobalScopeFact | ProviderScopeFact | WorkerScopeFact;

export interface ResourceStateFact {
  readonly usable: boolean;
}

export interface EffectivePermissions {
  readonly roleCodes: readonly string[];
  readonly permissionCodes: readonly string[];
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly denialCode?: AuthorizationDenialCode;
}

/** Permission check with optional ownership, scope, and resource-state facts. */
export interface AuthorizeInput {
  readonly principal: AuthenticationPrincipal;
  readonly permissionCode: string;
  readonly ownership?: OwnershipFact;
  readonly scope?: ScopeFact;
  readonly resourceState?: ResourceStateFact;
}

/** Check one declared protected operation, including its required rules. */
export interface AuthorizeProtectedOperationInput {
  readonly principal: AuthenticationPrincipal;
  readonly operationId: string;
  readonly ownership?: OwnershipFact;
  readonly scope?: ScopeFact;
  readonly resourceState?: ResourceStateFact;
}
