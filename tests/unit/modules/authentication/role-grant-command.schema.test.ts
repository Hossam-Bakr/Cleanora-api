import {
  ROLE_GRANT_NON_CUSTOMER_CODES,
  roleGrantCommandSchema,
} from "#modules/authentication/role-grant-command.schema";

const TARGET_USER_ID = "target-user-1";

describe("roleGrantCommandSchema", () => {
  it.each([
    ["assign", "role_grant_assign"],
    ["revoke", "role_grant_revoke"],
    ["enable", "role_grant_enable"],
    ["disable", "role_grant_disable"],
  ] as const)(
    "accepts %s with the matching reason for every non-customer role code",
    (operation, reasonCode) => {
      for (const roleCode of ROLE_GRANT_NON_CUSTOMER_CODES) {
        const result = roleGrantCommandSchema.safeParse({
          operation,
          targetUserId: TARGET_USER_ID,
          roleCode,
          reasonCode,
        });

        expect(result.success).toBe(true);
      }
    },
  );

  it("rejects customer role codes before command handling", () => {
    const result = roleGrantCommandSchema.safeParse({
      operation: "assign",
      targetUserId: TARGET_USER_ID,
      roleCode: "customer",
      reasonCode: "role_grant_assign",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown keys and mismatched reason codes", () => {
    expect(
      roleGrantCommandSchema.safeParse({
        operation: "assign",
        targetUserId: TARGET_USER_ID,
        roleCode: "staff_admin",
        reasonCode: "role_grant_disable",
      }).success,
    ).toBe(false);

    expect(
      roleGrantCommandSchema.safeParse({
        operation: "assign",
        targetUserId: TARGET_USER_ID,
        roleCode: "staff_admin",
        reasonCode: "role_grant_assign",
        extra: true,
      }).success,
    ).toBe(false);
  });
});
