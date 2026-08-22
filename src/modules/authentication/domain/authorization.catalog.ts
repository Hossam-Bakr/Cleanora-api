import type {
  PermissionDefinitionSeed,
  PrivilegedActionReasonSeed,
  ProtectedOperationDeclaration,
  RoleDefinitionSeed,
} from "./authorization.types.js";

/**
 * The finite R1-P03 authorization catalog (FR-002 and FR-026).
 *
 * This catalog is authorization-only. It carries no later-phase business
 * permission, and account categories never appear here because they are
 * identity facts, not roles.
 */

export const AUTHORIZATION_ROLES: readonly RoleDefinitionSeed[] = [
  { code: "customer", name: "Customer" },
  { code: "staff_admin", name: "Staff Administrator" },
  { code: "staff_operations", name: "Staff Operations" },
  { code: "staff_support", name: "Staff Support" },
  { code: "staff_finance", name: "Staff Finance" },
  { code: "provider_member", name: "Provider Member" },
  { code: "provider_supervisor", name: "Provider Supervisor" },
  { code: "provider_admin", name: "Provider Administrator" },
  { code: "worker", name: "Worker" },
];

export const AUTHORIZATION_PERMISSIONS: readonly PermissionDefinitionSeed[] = [
  { code: "resource.self.read", name: "Read own resource" },
  { code: "resource.self.write", name: "Write own resource" },
  { code: "authz.roles.assign", name: "Assign a user role grant" },
  { code: "authz.roles.revoke", name: "Revoke a user role grant" },
  { code: "authz.roles.enable", name: "Enable a user role grant" },
  { code: "authz.roles.disable", name: "Disable a user role grant" },
  { code: "authz.reasons.use", name: "Supply an approved privileged reason" },
  { code: "authz.staff.admin.sample", name: "Staff admin sample operation" },
  {
    code: "authz.staff.operations.sample",
    name: "Staff operations sample operation",
  },
  { code: "authz.staff.support.sample", name: "Staff support sample operation" },
  { code: "authz.staff.finance.sample", name: "Staff finance sample operation" },
  {
    code: "authz.scope.provider.member",
    name: "Act inside a provider as a member",
  },
  {
    code: "authz.scope.provider.supervisor",
    name: "Act inside a provider as a supervisor",
  },
  {
    code: "authz.scope.provider.admin",
    name: "Act inside a provider as a provider administrator",
  },
  { code: "authz.scope.worker", name: "Act inside a worker scope" },
  {
    code: "privacy.requests.reassign",
    name: "Reassign a privacy request processor",
  },
  {
    code: "providers.applications.review",
    name: "Review provider applications",
  },
  {
    code: "providers.lifecycle.manage",
    name: "Manage provider operational lifecycle",
  },
  {
    code: "providers.verification.documents.review",
    name: "Review provider verification documents",
  },
  {
    code: "providers.verification.policies.manage",
    name: "Manage provider verification policies",
  },
  {
    code: "providers.payout-destinations.verify",
    name: "Verify provider payout destinations",
  },
];

/**
 * Role-to-permission map. Staff sample permissions belong to exactly one staff
 * role each so holding one staff role never implies another staff role's power.
 */
export const ROLE_PERMISSION_MAP: Readonly<
  Record<string, readonly string[]>
> = {
  customer: ["resource.self.read", "resource.self.write"],
  staff_admin: [
    "authz.roles.assign",
    "authz.roles.revoke",
    "authz.roles.enable",
    "authz.roles.disable",
    "authz.reasons.use",
    "authz.staff.admin.sample",
    "privacy.requests.reassign",
    "providers.applications.review",
    "providers.lifecycle.manage",
    "providers.verification.documents.review",
    "providers.verification.policies.manage",
    "providers.payout-destinations.verify",
  ],
  staff_operations: ["authz.reasons.use", "authz.staff.operations.sample"],
  staff_support: ["authz.reasons.use", "authz.staff.support.sample"],
  staff_finance: ["authz.reasons.use", "authz.staff.finance.sample"],
  provider_member: ["authz.scope.provider.member"],
  provider_supervisor: ["authz.scope.provider.supervisor"],
  provider_admin: ["authz.scope.provider.admin"],
  worker: ["authz.scope.worker"],
};

/**
 * Privileged reasons are bound one-to-one to the operation they authorize.
 * Any other reason code for an operation fails closed.
 */
export const PRIVILEGED_ACTION_REASONS: readonly PrivilegedActionReasonSeed[] = [
  {
    code: "role_grant_assign",
    name: "Assign a role grant",
    operation: "ROLE_ASSIGN",
    isActive: true,
  },
  {
    code: "role_grant_revoke",
    name: "Revoke a role grant",
    operation: "ROLE_REVOKE",
    isActive: true,
  },
  {
    code: "role_grant_enable",
    name: "Enable a role grant",
    operation: "ROLE_ENABLE",
    isActive: true,
  },
  {
    code: "role_grant_disable",
    name: "Disable a role grant",
    operation: "ROLE_DISABLE",
    isActive: true,
  },
  {
    code: "staff_sample_privileged_write",
    name: "Staff sample privileged write",
    operation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
    isActive: true,
  },
  {
    code: "privacy_request_reassign",
    name: "Reassign a privacy request processor",
    operation: "PRIVACY_REQUEST_REASSIGN",
    isActive: true,
  },
];

/**
 * Role-management protected operations.
 *
 * Every declaration is internal: `publicHttp` is false because R1-P03 exposes
 * no HTTP endpoint. Each one is privileged, so it requires the approved reason
 * bound to its operation before any grant changes.
 */
const ROLE_MANAGEMENT_OPERATIONS: readonly ProtectedOperationDeclaration[] = [
  {
    operationId: "identity.roles.assign",
    permissionCode: "authz.roles.assign",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "ROLE_ASSIGN",
    publicHttp: false,
  },
  {
    operationId: "identity.roles.revoke",
    permissionCode: "authz.roles.revoke",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "ROLE_REVOKE",
    publicHttp: false,
  },
  {
    operationId: "identity.roles.enable",
    permissionCode: "authz.roles.enable",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "ROLE_ENABLE",
    publicHttp: false,
  },
  {
    operationId: "identity.roles.disable",
    permissionCode: "authz.roles.disable",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "ROLE_DISABLE",
    publicHttp: false,
  },
];

/**
 * Staff sample protected operations.
 *
 * These four declarations exist to prove staff powers stay separate. Each one
 * belongs to exactly one staff role, so one staff role never implies another.
 * They add no staff business write and no public endpoint.
 */
const STAFF_SAMPLE_OPERATIONS: readonly ProtectedOperationDeclaration[] = [
  {
    operationId: "identity.staff.sample.admin",
    permissionCode: "authz.staff.admin.sample",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
    publicHttp: false,
  },
  {
    operationId: "identity.staff.sample.operations",
    permissionCode: "authz.staff.operations.sample",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
    publicHttp: false,
  },
  {
    operationId: "identity.staff.sample.support",
    permissionCode: "authz.staff.support.sample",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
    publicHttp: false,
  },
  {
    operationId: "identity.staff.sample.finance",
    permissionCode: "authz.staff.finance.sample",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: true,
    reasonOperation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
    publicHttp: false,
  },
];

/**
 * R1-P04 privileged privacy reassignment (DEC-031).
 *
 * Internal only: `publicHttp` is false because reassignment is invoked through
 * the customers application port, not a public HTTP route in R1-P04.
 */
const PRIVACY_REASSIGNMENT_OPERATIONS: readonly ProtectedOperationDeclaration[] =
  [
    {
      operationId: "customers.privacy.requests.reassign",
      permissionCode: "privacy.requests.reassign",
      ownership: "NONE",
      scope: "GLOBAL",
      privileged: true,
      reasonOperation: "PRIVACY_REQUEST_REASSIGN",
      publicHttp: false,
    },
  ];

/**
 * R1-P05 Staff Admin provider review and lifecycle operations.
 *
 * Internal declarations so permission checks stay catalog-driven. Reasons for
 * changes/reject/suspend/reinstate are Provider status-history fields, not
 * PrivilegedActionOperation catalog reasons.
 */
const PROVIDER_STAFF_OPERATIONS: readonly ProtectedOperationDeclaration[] = [
  {
    operationId: "providers.applications.review",
    permissionCode: "providers.applications.review",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: false,
    publicHttp: false,
  },
  {
    operationId: "providers.lifecycle.manage",
    permissionCode: "providers.lifecycle.manage",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: false,
    publicHttp: false,
  },
  {
    operationId: "providers.verification.documents.review",
    permissionCode: "providers.verification.documents.review",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: false,
    publicHttp: false,
  },
  {
    operationId: "providers.verification.policies.manage",
    permissionCode: "providers.verification.policies.manage",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: false,
    publicHttp: false,
  },
  {
    operationId: "providers.payout-destinations.verify",
    permissionCode: "providers.payout-destinations.verify",
    ownership: "NONE",
    scope: "GLOBAL",
    privileged: false,
    publicHttp: false,
  },
];

/** Every declared protected operation. All are internal. */
export const PROTECTED_OPERATIONS: readonly ProtectedOperationDeclaration[] = [
  ...ROLE_MANAGEMENT_OPERATIONS,
  ...STAFF_SAMPLE_OPERATIONS,
  ...PRIVACY_REASSIGNMENT_OPERATIONS,
  ...PROVIDER_STAFF_OPERATIONS,
];

/** Find one declared protected operation, or `undefined` when undeclared. */
export function findProtectedOperation(
  operationId: string,
): ProtectedOperationDeclaration | undefined {
  return PROTECTED_OPERATIONS.find(
    (operation) => operation.operationId === operationId,
  );
}

/** Find one seeded privileged reason definition by its code. */
export function findPrivilegedActionReason(
  code: string,
): PrivilegedActionReasonSeed | undefined {
  return PRIVILEGED_ACTION_REASONS.find((reason) => reason.code === code);
}

/** Permission codes a role grants, or an empty list for an unknown role. */
export function permissionCodesForRole(roleCode: string): readonly string[] {
  return ROLE_PERMISSION_MAP[roleCode] ?? [];
}
