import { z } from "zod";

export const idempotencyKeySchema = z.string().min(1).max(128);

export const listMethodsQuerySchema = z.object({
  countryId: z.string().min(1),
});

export const initiateDepositBodySchema = z.object({
  bookingId: z.string().min(1),
  paymentMethodId: z.string().min(1),
});

export const browserReturnQuerySchema = z.object({
  paymentId: z.string().min(1).optional(),
  attemptId: z.string().min(1).optional(),
  returnToken: z.string().min(1).optional(),
  success: z.string().optional(),
});

export const paymentParamsSchema = z.object({
  paymentId: z.string().min(1),
});

export const methodParamsSchema = z.object({
  methodId: z.string().min(1),
});

export const setMethodEnabledBodySchema = z.object({
  enabled: z.boolean(),
});
