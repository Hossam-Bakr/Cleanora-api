import { z } from "zod";

/** Non-customer role codes allowed on the ordinary staff-admin command API. */
export const ROLE_GRANT_NON_CUSTOMER_CODES = [
  "staff_admin",
  "staff_operations",
  "staff_support",
  "staff_finance",
  "provider_member",
  "provider_supervisor",
  "provider_admin",
  "worker",
] as const;

const operationReason = {
  assign: "role_grant_assign",
  revoke: "role_grant_revoke",
  enable: "role_grant_enable",
  disable: "role_grant_disable",
} as const;

export const roleGrantCommandSchema = z
  .object({
    operation: z.enum(["assign", "revoke", "enable", "disable"]),
    targetUserId: z.string().trim().min(1).max(128),
    roleCode: z.enum(ROLE_GRANT_NON_CUSTOMER_CODES),
    reasonCode: z.string().trim().min(1).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (operationReason[value.operation] !== value.reasonCode) {
      context.addIssue({
        code: "custom",
        path: ["reasonCode"],
        message: "Reason code must match the operation.",
      });
    }
  });

export type RoleGrantCommandBody = z.infer<typeof roleGrantCommandSchema>;
