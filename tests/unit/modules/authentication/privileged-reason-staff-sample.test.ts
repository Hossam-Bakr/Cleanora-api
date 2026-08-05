import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PRIVILEGED_ACTION_REASONS,
  findPrivilegedActionReason,
  findProtectedOperation,
} from "../../../../src/modules/authentication/domain/authorization.catalog.js";

const roleManagementSource = readFileSync(
  join(process.cwd(), "src/modules/authentication/role-management.service.ts"),
  "utf8",
);

/**
 * `staff_sample_privileged_write` stays a seeded reason and a policy case only.
 * R1-P03 adds no staff business write and no staff role-management method.
 */
describe("staff sample privileged reason", () => {
  it("is seeded exactly once and bound to the staff sample operation", () => {
    const staffSampleReasons = PRIVILEGED_ACTION_REASONS.filter(
      (reason) => reason.operation === "STAFF_SAMPLE_PRIVILEGED_WRITE",
    );

    expect(staffSampleReasons).toHaveLength(1);
    expect(staffSampleReasons[0]).toEqual({
      code: "staff_sample_privileged_write",
      name: "Staff sample privileged write",
      operation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
      isActive: true,
    });
  });

  it("is active by default and resolvable by code", () => {
    expect(
      findPrivilegedActionReason("staff_sample_privileged_write")?.isActive,
    ).toBe(true);
  });

  it("cannot stand in for a role-management operation reason", () => {
    const staffSampleReason = findPrivilegedActionReason(
      "staff_sample_privileged_write",
    );
    const assignDeclaration = findProtectedOperation("identity.roles.assign");

    expect(staffSampleReason?.operation).not.toBe(
      assignDeclaration?.reasonOperation,
    );
  });

  it("adds no staff write method to role management", () => {
    expect(roleManagementSource).not.toMatch(/staffSample/iu);
    expect(roleManagementSource).not.toMatch(
      /STAFF_SAMPLE_PRIVILEGED_WRITE/u,
    );
  });

  it("declares each staff sample operation with the shared staff reason", () => {
    for (const operationId of [
      "identity.staff.sample.admin",
      "identity.staff.sample.operations",
      "identity.staff.sample.support",
      "identity.staff.sample.finance",
    ]) {
      expect(findProtectedOperation(operationId)?.reasonOperation).toBe(
        "STAFF_SAMPLE_PRIVILEGED_WRITE",
      );
    }
  });
});
