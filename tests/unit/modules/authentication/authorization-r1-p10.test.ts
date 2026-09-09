import {
  AUTHORIZATION_PERMISSIONS,
  PRIVILEGED_ACTION_REASONS,
  PROTECTED_OPERATIONS,
  ROLE_PERMISSION_MAP,
  findPrivilegedActionReason,
  findProtectedOperation,
} from "../../../../src/modules/authentication/domain/authorization.catalog.js";

describe("R1-P10 Configuration locality/time-zone catalog (DEC-053, DEC-056)", () => {
  it("maps configuration.localities.read and .write to staff_admin only", () => {
    for (const permissionCode of [
      "configuration.localities.read",
      "configuration.localities.write",
    ]) {
      const holders = Object.entries(ROLE_PERMISSION_MAP)
        .filter(([, codes]) => codes.includes(permissionCode))
        .map(([roleCode]) => roleCode);
      expect(holders).toEqual(["staff_admin"]);
    }
  });

  it("binds configuration_locality_change to CONFIGURATION_LOCALITY_WRITE", () => {
    expect(findPrivilegedActionReason("configuration_locality_change")).toEqual(
      expect.objectContaining({
        code: "configuration_locality_change",
        operation: "CONFIGURATION_LOCALITY_WRITE",
        isActive: true,
      }),
    );
  });

  it("declares configuration.localities.read as non-privileged", () => {
    expect(findProtectedOperation("configuration.localities.read")).toEqual(
      expect.objectContaining({
        operationId: "configuration.localities.read",
        permissionCode: "configuration.localities.read",
        ownership: "NONE",
        scope: "GLOBAL",
        privileged: false,
        publicHttp: false,
      }),
    );
  });

  it("declares configuration.localities.write as privileged with CONFIGURATION_LOCALITY_WRITE", () => {
    expect(findProtectedOperation("configuration.localities.write")).toEqual(
      expect.objectContaining({
        operationId: "configuration.localities.write",
        permissionCode: "configuration.localities.write",
        ownership: "NONE",
        scope: "GLOBAL",
        privileged: true,
        reasonOperation: "CONFIGURATION_LOCALITY_WRITE",
        publicHttp: false,
      }),
    );
  });

  it("rejects an unapproved reason code for the write operation", () => {
    expect(findPrivilegedActionReason("not_a_real_reason")).toBeUndefined();
  });

  it("keeps the additive R1-P10 catalog rows present exactly once", () => {
    expect(
      AUTHORIZATION_PERMISSIONS.filter((permission) =>
        permission.code.startsWith("configuration.localities."),
      ),
    ).toHaveLength(2);
    expect(
      PRIVILEGED_ACTION_REASONS.filter(
        (reason) => reason.code === "configuration_locality_change",
      ),
    ).toHaveLength(1);
    expect(
      PROTECTED_OPERATIONS.filter((operation) =>
        operation.operationId.startsWith("configuration.localities."),
      ),
    ).toHaveLength(2);
  });
});
