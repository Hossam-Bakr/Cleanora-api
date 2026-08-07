import { z } from "zod";

/** Owner provision body uses email only (DEC-030). No role or authority fields. */
export const ownerStaffAdminProvisionSchema = z
  .object({
    email: z.string().trim().email().max(320),
  })
  .strict();

export type OwnerStaffAdminProvisionBody = z.infer<
  typeof ownerStaffAdminProvisionSchema
>;
