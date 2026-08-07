import { ownerStaffAdminProvisionSchema } from "#modules/authentication/owner-staff-admin.schema";

describe("ownerStaffAdminProvisionSchema", () => {
  it("accepts an email-only body", () => {
    const result = ownerStaffAdminProvisionSchema.safeParse({
      email: "owner-provision@example.test",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ email: "owner-provision@example.test" });
    }
  });

  it("rejects missing email", () => {
    const result = ownerStaffAdminProvisionSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects role or authority fields and other unknown keys", () => {
    for (const body of [
      { email: "owner-provision@example.test", roleCode: "staff_admin" },
      { email: "owner-provision@example.test", operation: "assign" },
      { email: "owner-provision@example.test", reasonCode: "role_grant_assign" },
      { email: "owner-provision@example.test", extra: true },
    ]) {
      expect(ownerStaffAdminProvisionSchema.safeParse(body).success).toBe(false);
    }
  });
});
