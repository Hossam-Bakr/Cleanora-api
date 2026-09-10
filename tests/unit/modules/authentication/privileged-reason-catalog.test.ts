import {
  PRIVILEGED_ACTION_REASONS,
  findPrivilegedActionReason,
} from "../../../../src/modules/authentication/domain/authorization.catalog.js";

const expectedBindings = [
  { code: "role_grant_assign", operation: "ROLE_ASSIGN" },
  { code: "role_grant_revoke", operation: "ROLE_REVOKE" },
  { code: "role_grant_enable", operation: "ROLE_ENABLE" },
  { code: "role_grant_disable", operation: "ROLE_DISABLE" },
  {
    code: "staff_sample_privileged_write",
    operation: "STAFF_SAMPLE_PRIVILEGED_WRITE",
  },
  {
    code: "privacy_request_reassign",
    operation: "PRIVACY_REQUEST_REASSIGN",
  },
  {
    code: "catalog_management_change",
    operation: "CATALOG_MANAGEMENT_WRITE",
  },
  {
    code: "configuration_locality_change",
    operation: "CONFIGURATION_LOCALITY_WRITE",
  },
];

describe("FR-026 privileged-action reason catalog", () => {
  it("seeds exactly the approved reason codes and operations", () => {
    expect(
      PRIVILEGED_ACTION_REASONS.map((reason) => ({
        code: reason.code,
        operation: reason.operation,
      })),
    ).toEqual(expectedBindings);
  });

  it("marks every seeded reason active by default", () => {
    for (const reason of PRIVILEGED_ACTION_REASONS) {
      expect(reason.isActive).toBe(true);
    }
  });

  it("gives every reason a human-readable label", () => {
    for (const reason of PRIVILEGED_ACTION_REASONS) {
      expect(reason.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("binds each reason code one-to-one to one operation", () => {
    const codes = PRIVILEGED_ACTION_REASONS.map((reason) => reason.code);
    const operations = PRIVILEGED_ACTION_REASONS.map(
      (reason) => reason.operation,
    );

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(operations).size).toBe(operations.length);
  });

  it("looks up a seeded reason by code", () => {
    expect(findPrivilegedActionReason("role_grant_enable")).toMatchObject({
      code: "role_grant_enable",
      operation: "ROLE_ENABLE",
      isActive: true,
    });
  });

  it("returns nothing for an unknown reason code", () => {
    expect(findPrivilegedActionReason("role_grant_unknown")).toBeUndefined();
  });

  it("excludes later-phase business reason codes", () => {
    const codes = PRIVILEGED_ACTION_REASONS.map((reason) => reason.code);
    for (const forbidden of [
      "payment",
      "payout",
      "refund",
      "settlement",
      "booking",
      "provider",
      "support_ticket",
    ]) {
      expect(codes.filter((code) => code.includes(forbidden))).toEqual([]);
    }
  });
});
