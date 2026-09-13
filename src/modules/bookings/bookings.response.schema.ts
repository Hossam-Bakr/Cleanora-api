import { z } from "zod";

export const providerBookingParamsSchema = z
  .object({
    providerId: z.string().trim().min(1).max(64),
    bookingId: z.string().trim().min(1).max(64),
  })
  .strict();

export const providerInboxParamsSchema = z
  .object({
    providerId: z.string().trim().min(1).max(64),
  })
  .strict();

export const inboxQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export const versionBodySchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();

export const reasonVersionBodySchema = z
  .object({
    version: z.number().int().positive(),
    reasonCode: z.string().trim().min(1).max(64),
  })
  .strict();

export const staffBookingParamsSchema = z
  .object({
    bookingId: z.string().trim().min(1).max(64),
  })
  .strict();

export const cancellationReasonsQuerySchema = z
  .object({
    actor: z.enum(["CUSTOMER", "PROVIDER", "STAFF_ADMIN"]),
    purpose: z.enum(["REJECT", "CANCEL"]),
  })
  .strict();
