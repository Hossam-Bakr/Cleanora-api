import {
  AUTHORIZATION_PERMISSIONS,
  PROTECTED_OPERATIONS,
  findPrivilegedActionReason,
  findProtectedOperation,
} from "../../../../src/modules/authentication/domain/authorization.catalog.js";

const roleManagementOperations = [
  {
    operationId: "identity.roles.assign",
    permissionCode: "authz.roles.assign",
    reasonOperation: "ROLE_ASSIGN",
  },
  {
    operationId: "identity.roles.revoke",
    permissionCode: "authz.roles.revoke",
    reasonOperation: "ROLE_REVOKE",
  },
  {
    operationId: "identity.roles.enable",
    permissionCode: "authz.roles.enable",
    reasonOperation: "ROLE_ENABLE",
  },
  {
    operationId: "identity.roles.disable",
    permissionCode: "authz.roles.disable",
    reasonOperation: "ROLE_DISABLE",
  },
];

describe("R1-P03 protected-operation declarations", () => {
  it.each(roleManagementOperations)(
    "declares $operationId as an internal privileged operation",
    ({ operationId, permissionCode, reasonOperation }) => {
      expect(findProtectedOperation(operationId)).toEqual({
        operationId,
        permissionCode,
        ownership: "NONE",
        scope: "GLOBAL",
        privileged: true,
        reasonOperation,
        publicHttp: false,
      });
    },
  );

  it("keeps every declaration internal, so R1-P03 exposes no public endpoint", () => {
    for (const operation of PROTECTED_OPERATIONS) {
      expect(operation.publicHttp).toBe(false);
    }
  });

  it("declares only permissions that exist in the FR-002 catalog", () => {
    const permissionCodes = AUTHORIZATION_PERMISSIONS.map(
      (permission) => permission.code,
    );

    for (const operation of PROTECTED_OPERATIONS) {
      expect(permissionCodes).toContain(operation.permissionCode);
    }
  });

  it("binds every privileged declaration to one seeded active reason operation", () => {
    for (const operation of PROTECTED_OPERATIONS) {
      if (!operation.privileged) {
        continue;
      }
      expect(operation.reasonOperation).toBeDefined();

      const reasons = [
        "ROLE_ASSIGN",
        "ROLE_REVOKE",
        "ROLE_ENABLE",
        "ROLE_DISABLE",
        "STAFF_SAMPLE_PRIVILEGED_WRITE",
        "PRIVACY_REQUEST_REASSIGN",
      ];
      expect(reasons).toContain(operation.reasonOperation);
    }
  });

  it("keeps privileged reason codes resolvable for role-management operations", () => {
    expect(findPrivilegedActionReason("role_grant_assign")?.operation).toBe(
      "ROLE_ASSIGN",
    );
  });

  it("declares no existing authentication endpoint as an R1-P03 protected operation", () => {
    const operationIds = PROTECTED_OPERATIONS.map(
      (operation) => operation.operationId,
    );

    for (const authenticationOperation of [
      "identity.auth.signup",
      "identity.auth.login",
      "identity.auth.refresh",
      "identity.auth.logout",
      "identity.auth.me",
      "identity.auth.password.reset",
      "identity.auth.google.callback",
    ]) {
      expect(operationIds).not.toContain(authenticationOperation);
    }
  });

  it("has no duplicate operation id", () => {
    const operationIds = PROTECTED_OPERATIONS.map(
      (operation) => operation.operationId,
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("returns undefined for an undeclared operation id", () => {
    expect(findProtectedOperation("identity.roles.invent")).toBeUndefined();
  });
});
