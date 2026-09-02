import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import { findProtectedOperation } from "../../../../src/modules/authentication/domain/authorization.catalog.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

const staffSampleOperations = [
  { operationId: "identity.staff.sample.admin", roleCode: "staff_admin" },
  {
    operationId: "identity.staff.sample.operations",
    roleCode: "staff_operations",
  },
  { operationId: "identity.staff.sample.support", roleCode: "staff_support" },
  { operationId: "identity.staff.sample.finance", roleCode: "staff_finance" },
];

function serviceForRole(roleCode: string): AuthorizationService {
  return new AuthorizationService(
    createGrantReaderForEnabledRoles({ "actor-1": [roleCode] }),
  );
}

/**
 * Staff powers stay separate: holding one staff role never implies another
 * staff role's sample operation.
 */
describe("staff power separation", () => {
  it.each(staffSampleOperations)(
    "declares $operationId as an internal staff sample operation",
    ({ operationId }) => {
      const declaration = findProtectedOperation(operationId);

      expect(declaration).toMatchObject({
        ownership: "NONE",
        scope: "GLOBAL",
        privileged: true,
        reasonOperation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
        publicHttp: false,
      });
    },
  );

  it.each(staffSampleOperations)(
    "allows only $roleCode to run $operationId",
    async ({ operationId, roleCode }) => {
      const principal = createTestPrincipal();

      await expect(
        serviceForRole(roleCode).authorizeProtectedOperation({
          principal,
          operationId,
        }),
      ).resolves.toEqual({ allowed: true });

      const otherStaffRoles = staffSampleOperations
        .map((operation) => operation.roleCode)
        .filter((candidate) => candidate !== roleCode);

      for (const otherRole of otherStaffRoles) {
        const decision = await serviceForRole(
          otherRole,
        ).authorizeProtectedOperation({ principal, operationId });
        expect(decision).toEqual({
          allowed: false,
          denialCode: "PERMISSION_DENIED",
        });
      }
    },
  );

  it("denies every staff sample operation to a customer", async () => {
    for (const { operationId } of staffSampleOperations) {
      const decision = await serviceForRole("customer").authorizeProtectedOperation(
        { principal: createTestPrincipal(), operationId },
      );
      expect(decision.allowed).toBe(false);
    }
  });

  it("keeps staff sample operations out of role management", async () => {
    const roleManagementOnly = [
      "authz.roles.assign",
      "authz.roles.revoke",
      "authz.roles.enable",
      "authz.roles.disable",
    ];

    for (const permissionCode of roleManagementOnly) {
      const decision = await serviceForRole("staff_support").authorize({
        principal: createTestPrincipal(),
        permissionCode,
      });
      expect(decision.allowed).toBe(false);
    }
  });
});

describe("R1-P08 Catalog staff separation (DEC-043)", () => {
  it("allows only active staff_admin to read Catalog management", async () => {
    const principal = createTestPrincipal();
    await expect(
      serviceForRole("staff_admin").authorizeProtectedOperation({
        principal,
        operationId: "catalog.management.read",
      }),
    ).resolves.toEqual({ allowed: true });

    for (const roleCode of [
      "staff_operations",
      "staff_support",
      "staff_finance",
      "customer",
      "provider_admin",
      "worker",
    ]) {
      await expect(
        serviceForRole(roleCode).authorizeProtectedOperation({
          principal,
          operationId: "catalog.management.read",
        }),
      ).resolves.toEqual({
        allowed: false,
        denialCode: "PERMISSION_DENIED",
      });
    }
  });

  it("allows only active staff_admin to write Catalog management", async () => {
    const principal = createTestPrincipal();
    await expect(
      serviceForRole("staff_admin").authorizeProtectedOperation({
        principal,
        operationId: "catalog.management.write",
      }),
    ).resolves.toEqual({ allowed: true });

    for (const roleCode of [
      "staff_operations",
      "staff_support",
      "staff_finance",
      "customer",
      "provider_admin",
      "worker",
    ]) {
      await expect(
        serviceForRole(roleCode).authorizeProtectedOperation({
          principal,
          operationId: "catalog.management.write",
        }),
      ).resolves.toEqual({
        allowed: false,
        denialCode: "PERMISSION_DENIED",
      });
    }
  });
});
