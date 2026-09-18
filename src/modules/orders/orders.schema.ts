import { z } from "zod";

export const orderIdParamsSchema = z.object({
  orderId: z.string().min(1).max(128),
});

export const bookingIdParamsSchema = z.object({
  bookingId: z.string().min(1).max(128),
});

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export const completeOrderBodySchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/u),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export const attachMediaBodySchema = z.object({
  mediaFileId: z.string().min(1).max(128),
  kind: z.enum(["PROGRESS", "COMPLETION"]),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export const addNoteBodySchema = z.object({
  body: z.string().min(1).max(2000),
  idempotencyKey: idempotencyKeySchema.optional(),
});

export const emptyTransitionBodySchema = z
  .object({
    idempotencyKey: idempotencyKeySchema.optional(),
  })
  .default({});
