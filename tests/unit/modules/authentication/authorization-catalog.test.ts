import {
  AUTHORIZATION_PERMISSIONS,
  AUTHORIZATION_ROLES,
  PRIVILEGED_ACTION_REASONS,
  PROTECTED_OPERATIONS,
  ROLE_PERMISSION_MAP,
  findPrivilegedActionReason,
  findProtectedOperation,
} from "../../../../src/modules/authentication/domain/authorization.catalog.js";

const expectedRoleCodes = [
  "customer",
  "staff_admin",
  "staff_operations",
  "staff_support",
  "staff_finance",
  "provider_member",
  "provider_supervisor",
  "provider_admin",
  "worker",
];

const expectedPermissionCodes = [
  "resource.self.read",
  "resource.self.write",
  "authz.roles.assign",
  "authz.roles.revoke",
  "authz.roles.enable",
  "authz.roles.disable",
  "authz.reasons.use",
  "authz.staff.admin.sample",
  "authz.staff.operations.sample",
  "authz.staff.support.sample",
  "authz.staff.finance.sample",
  "authz.scope.provider.member",
  "authz.scope.provider.supervisor",
  "authz.scope.provider.admin",
  "authz.scope.worker",
  "privacy.requests.reassign",
  "providers.applications.review",
  "providers.lifecycle.manage",
  "providers.verification.documents.review",
  "providers.verification.policies.manage",
  "providers.payout-destinations.verify",
  "catalog.management.read",
  "catalog.management.write",
];

const expectedRolePermissionMap: Record<string, string[]> = {
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
    "catalog.management.read",
    "catalog.management.write",
  ],
  staff_operations: ["authz.reasons.use", "authz.staff.operations.sample"],
  staff_support: ["authz.reasons.use", "authz.staff.support.sample"],
  staff_finance: ["authz.reasons.use", "authz.staff.finance.sample"],
  provider_member: ["authz.scope.provider.member"],
  provider_supervisor: ["authz.scope.provider.supervisor"],
  provider_admin: ["authz.scope.provider.admin"],
  worker: ["authz.scope.worker"],
};

describe("FR-002 authorization catalog", () => {
  it("seeds exactly the approved role codes", () => {
    expect(AUTHORIZATION_ROLES.map((role) => role.code)).toEqual(
      expectedRoleCodes,
    );
  });

  it("seeds exactly the approved permission codes", () => {
    expect(AUTHORIZATION_PERMISSIONS.map((permission) => permission.code)).toEqual(
      expectedPermissionCodes,
    );
  });

  it("gives every role and permission a human-readable label", () => {
    for (const definition of [
      ...AUTHORIZATION_ROLES,
      ...AUTHORIZATION_PERMISSIONS,
    ]) {
      expect(definition.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("maps every role to exactly the approved permissions", () => {
    expect(ROLE_PERMISSION_MAP).toEqual(expectedRolePermissionMap);
  });

  it("maps only catalog roles onto catalog permissions", () => {
    for (const [roleCode, permissionCodes] of Object.entries(
      ROLE_PERMISSION_MAP,
    )) {
      expect(expectedRoleCodes).toContain(roleCode);
      for (const permissionCode of permissionCodes) {
        expect(expectedPermissionCodes).toContain(permissionCode);
      }
    }
  });

  it("keeps staff separation sample permissions mutually exclusive", () => {
    const staffSamplePermissions = expectedPermissionCodes.filter((code) =>
      code.startsWith("authz.staff."),
    );

    for (const permissionCode of staffSamplePermissions) {
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, codes]) => codes.includes(permissionCode))
        .map(([roleCode]) => roleCode);
      expect(holders).toHaveLength(1);
    }
  });

  it("grants role-management permissions to staff_admin only", () => {
    for (const permissionCode of [
      "authz.roles.assign",
      "authz.roles.revoke",
      "authz.roles.enable",
      "authz.roles.disable",
    ]) {
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, codes]) => codes.includes(permissionCode))
        .map(([roleCode]) => roleCode);
      expect(holders).toEqual(["staff_admin"]);
    }
  });

  it("excludes later-phase business permissions", () => {
    // Implemented R1-P05/R1-P06 Staff Provider permissions are intentional.
    const implementedStaffProviderPermissions = new Set([
      "providers.applications.review",
      "providers.lifecycle.manage",
      "providers.verification.documents.review",
      "providers.verification.policies.manage",
      "providers.payout-destinations.verify",
    ]);
    for (const forbidden of [
      "provider",
      "worker.",
      "payment",
      "payout",
      "settlement",
      "finance.ledger",
      "support.ticket",
      "profile",
      "dashboard",
    ]) {
      const leaked = expectedPermissionCodes.filter(
        (code) =>
          code.includes(forbidden) &&
          !code.startsWith("authz.scope.") &&
          !implementedStaffProviderPermissions.has(code),
      );
      expect(leaked).toEqual([]);
    }
  });

  it("grants implemented Provider Staff permissions to staff_admin only", () => {
    for (const permissionCode of [
      "providers.applications.review",
      "providers.lifecycle.manage",
      "providers.verification.documents.review",
      "providers.verification.policies.manage",
      "providers.payout-destinations.verify",
    ]) {
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, codes]) => codes.includes(permissionCode))
        .map(([roleCode]) => roleCode);
      expect(holders).toEqual(["staff_admin"]);
    }
  });

  it("never treats an account category as a role", () => {
    for (const category of [
      "INDIVIDUAL",
      "COMPANY",
      "ENGINEER",
      "PROVIDER_OWNER",
      "WORKER",
    ]) {
      expect(AUTHORIZATION_ROLES.map((role) => role.code)).not.toContain(
        category,
      );
    }
    // `individual`, `company`, `engineer`, and `provider_owner` are enrollment
    // facts, so no role code mirrors them. The `worker` role is an FR-002
    // authorization role that is granted explicitly, never derived from the
    // WORKER account category.
    for (const enrollmentOnly of [
      "individual",
      "company",
      "engineer",
      "provider_owner",
    ]) {
      expect(expectedRoleCodes).not.toContain(enrollmentOnly);
    }
  });
});

describe("R1-P04 privacy reassignment catalog (DEC-031)", () => {
  it("maps privacy.requests.reassign to staff_admin only", () => {
    const holders = Object.entries(ROLE_PERMISSION_MAP)
      .filter(([, codes]) => codes.includes("privacy.requests.reassign"))
      .map(([roleCode]) => roleCode);

    expect(holders).toEqual(["staff_admin"]);
  });

  it("binds privacy_request_reassign to PRIVACY_REQUEST_REASSIGN", () => {
    expect(findPrivilegedActionReason("privacy_request_reassign")).toEqual(
      expect.objectContaining({
        code: "privacy_request_reassign",
        operation: "PRIVACY_REQUEST_REASSIGN",
        isActive: true,
      }),
    );
  });

  it("declares the internal customers.privacy.requests.reassign operation", () => {
    expect(findProtectedOperation("customers.privacy.requests.reassign")).toEqual(
      expect.objectContaining({
        operationId: "customers.privacy.requests.reassign",
        permissionCode: "privacy.requests.reassign",
        reasonOperation: "PRIVACY_REQUEST_REASSIGN",
        privileged: true,
        publicHttp: false,
      }),
    );
  });

  it("keeps the additive catalog rows present exactly once", () => {
    expect(
      AUTHORIZATION_PERMISSIONS.filter(
        (permission) => permission.code === "privacy.requests.reassign",
      ),
    ).toHaveLength(1);
    expect(
      PRIVILEGED_ACTION_REASONS.filter(
        (reason) => reason.code === "privacy_request_reassign",
      ),
    ).toHaveLength(1);
    expect(
      PROTECTED_OPERATIONS.filter(
        (operation) =>
          operation.operationId === "customers.privacy.requests.reassign",
      ),
    ).toHaveLength(1);
  });
});

describe("R1-P08 Catalog management catalog (DEC-043)", () => {
  it("maps catalog.management.read and catalog.management.write to staff_admin only", () => {
    for (const permissionCode of [
      "catalog.management.read",
      "catalog.management.write",
    ]) {
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, codes]) => codes.includes(permissionCode))
        .map(([roleCode]) => roleCode);
      expect(holders).toEqual(["staff_admin"]);
    }
  });

  it("binds catalog_management_change to CATALOG_MANAGEMENT_WRITE", () => {
    expect(findPrivilegedActionReason("catalog_management_change")).toEqual(
      expect.objectContaining({
        code: "catalog_management_change",
        operation: "CATALOG_MANAGEMENT_WRITE",
        isActive: true,
      }),
    );
  });

  it("declares catalog.management.read as non-privileged", () => {
    expect(findProtectedOperation("catalog.management.read")).toEqual(
      expect.objectContaining({
        operationId: "catalog.management.read",
        permissionCode: "catalog.management.read",
        ownership: "NONE",
        scope: "GLOBAL",
        privileged: false,
        publicHttp: false,
      }),
    );
  });

  it("declares catalog.management.write as privileged with CATALOG_MANAGEMENT_WRITE", () => {
    expect(findProtectedOperation("catalog.management.write")).toEqual(
      expect.objectContaining({
        operationId: "catalog.management.write",
        permissionCode: "catalog.management.write",
        ownership: "NONE",
        scope: "GLOBAL",
        privileged: true,
        reasonOperation: "CATALOG_MANAGEMENT_WRITE",
        publicHttp: false,
      }),
    );
  });

  it("keeps the additive Catalog catalog rows present exactly once", () => {
    expect(
      AUTHORIZATION_PERMISSIONS.filter((permission) =>
        permission.code.startsWith("catalog.management."),
      ),
    ).toHaveLength(2);
    expect(
      PRIVILEGED_ACTION_REASONS.filter(
        (reason) => reason.code === "catalog_management_change",
      ),
    ).toHaveLength(1);
    expect(
      PROTECTED_OPERATIONS.filter((operation) =>
        operation.operationId.startsWith("catalog.management."),
      ),
    ).toHaveLength(2);
  });
});
