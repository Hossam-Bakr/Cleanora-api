/**
 * Strict Zod boundaries for Provider Service management (R1-P09 US1/US3).
 * Unknown monetary totals, currency, actor, and fee fields are rejected.
 */

import { z } from "zod";

const CANONICAL_DECIMAL =
  /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u;

const forbiddenClientMoneyKeys = [
  "subtotal",
  "total",
  "tax",
  "fee",
  "discount",
  "commission",
  "deposit",
  "payable",
  "currency",
  "currencyCode",
  "currencyId",
  "actorUserId",
  "actorId",
  "approvalRequired",
  "maximumPrice",
] as const;

const monetaryInput = z
  .string()
  .regex(CANONICAL_DECIMAL, "Canonical decimal string required");

const noteField = z.string().nullable().optional();

export const providerServiceProviderParamsSchema = z
  .object({
    providerId: z.string().min(1),
  })
  .strict();

export const providerServiceDetailParamsSchema = providerServiceProviderParamsSchema
  .extend({
    providerServiceId: z.string().min(1),
  })
  .strict();

export const providerServiceListQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const staffPendingPriceProposalsQuerySchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Za-z]{2}$/u)
      .transform((value) => value.toUpperCase())
      .optional(),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const staffPendingPriceProposalParamsSchema = z
  .object({
    providerId: z.string().min(1),
    providerServiceId: z.string().min(1),
    providerServicePriceId: z.string().min(1),
  })
  .strict();

export const staffPriceDecisionBodySchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().min(1).max(1000),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

/**
 * Reject known client-invented monetary/authority keys even if `.strict()`
 * would already fail, so error details stay allowlisted and predictable.
 */
function rejectForbiddenMoneyFields(
  value: Record<string, unknown>,
  context: z.RefinementCtx,
): void {
  for (const key of forbiddenClientMoneyKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      context.addIssue({
        code: "custom",
        message: "Unknown or forbidden field",
        path: [key],
      });
    }
  }
}

export const createProviderServiceBodySchema = z
  .object({
    catalogServiceCode: z.string().trim().min(1).max(100),
    catalogPriceUnitId: z.string().min(1),
    price: monetaryInput,
    minimumCharge: monetaryInput,
    estimatedDurationMinutes: z.number().int().min(1).max(1440),
    noteAr: noteField,
    noteEn: noteField,
    expectedVersion: z.literal(0),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    rejectForbiddenMoneyFields(value as Record<string, unknown>, context);
    const hasAr = value.noteAr !== undefined && value.noteAr !== null;
    const hasEn = value.noteEn !== undefined && value.noteEn !== null;
    if (hasAr !== hasEn) {
      context.addIssue({
        code: "custom",
        message: "noteAr and noteEn must both be present or both absent",
        path: ["noteAr"],
      });
    }
  });

export const replaceProviderServiceConfigurationBodySchema = z
  .object({
    estimatedDurationMinutes: z.number().int().min(1).max(1440),
    noteAr: z.string().nullable(),
    noteEn: z.string().nullable(),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    rejectForbiddenMoneyFields(value as Record<string, unknown>, context);
    const arNull = value.noteAr === null;
    const enNull = value.noteEn === null;
    if (arNull !== enNull) {
      context.addIssue({
        code: "custom",
        message: "noteAr and noteEn must both be null or both strings",
        path: ["noteAr"],
      });
    }
  });

export const proposeProviderServicePriceBodySchema = z
  .object({
    catalogPriceUnitId: z.string().min(1),
    price: monetaryInput,
    minimumCharge: monetaryInput,
    reason: z.string().trim().min(1).max(1000),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    rejectForbiddenMoneyFields(value as Record<string, unknown>, context);
  });

export const providerServiceLifecycleBodySchema = z
  .object({
    action: z.enum(["ENABLE", "DISABLE"]),
    reason: z.string().trim().min(1).max(1000),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const providerServiceHistoryQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export type CreateProviderServiceBody = z.infer<
  typeof createProviderServiceBodySchema
>;
export type ReplaceProviderServiceConfigurationBody = z.infer<
  typeof replaceProviderServiceConfigurationBodySchema
>;
export type ProposeProviderServicePriceBody = z.infer<
  typeof proposeProviderServicePriceBodySchema
>;
export type ProviderServiceLifecycleBody = z.infer<
  typeof providerServiceLifecycleBodySchema
>;
export type StaffPendingPriceProposalsQuery = z.infer<
  typeof staffPendingPriceProposalsQuerySchema
>;
export type StaffPriceDecisionBody = z.infer<typeof staffPriceDecisionBodySchema>;
