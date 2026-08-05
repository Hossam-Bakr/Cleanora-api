import {
  AUTHORIZATION_PERMISSIONS,
  AUTHORIZATION_ROLES,
  ROLE_PERMISSION_MAP,
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
          code.includes(forbidden) && !code.startsWith("authz.scope."),
      );
      expect(leaked).toEqual([]);
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
