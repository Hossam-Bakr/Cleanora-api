/**
 * Zod boundary schemas for Provider availability management HTTP endpoints.
 */

import { z } from "zod";

export const providerIdParamsSchema = z
  .object({ providerId: z.string().trim().min(1) })
  .strict();

export const providerWorkerCalendarParamsSchema = z
  .object({
    providerId: z.string().trim().min(1),
    workerId: z.string().trim().min(1),
  })
  .strict();

const coverageSelectionSchema = z
  .object({
    type: z.enum(["CITY", "DISTRICT"]),
    id: z.string().trim().min(1),
  })
  .strict();

export const replaceCoverageBodySchema = z
  .object({
    selections: z.array(coverageSelectionSchema).min(1).max(200),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
    reasonCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type ReplaceCoverageBody = z.infer<typeof replaceCoverageBodySchema>;

const availabilityWeekdaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

const scheduleMinuteSchema = z.number().int().min(0).max(1_439);

const weeklyPeriodSchema = z
  .object({
    weekday: availabilityWeekdaySchema,
    startMinute: scheduleMinuteSchema,
    endMinute: scheduleMinuteSchema,
    endsNextDay: z.boolean(),
  })
  .strict();

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "localDate must use YYYY-MM-DD");

const scheduleExceptionSchema = z
  .object({
    localDate: localDateSchema,
    closed: z.boolean(),
    startMinute: scheduleMinuteSchema.nullish(),
    endMinute: scheduleMinuteSchema.nullish(),
    endsNextDay: z.boolean().nullish(),
  })
  .strict();

export const replaceProviderCalendarBodySchema = z
  .object({
    weeklyPeriods: z.array(weeklyPeriodSchema).max(200),
    exceptions: z.array(scheduleExceptionSchema).max(366),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
    reasonCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type ReplaceProviderCalendarBody = z.infer<
  typeof replaceProviderCalendarBodySchema
>;

export const replaceWorkerCalendarBodySchema = replaceProviderCalendarBodySchema;

export type ReplaceWorkerCalendarBody = z.infer<
  typeof replaceWorkerCalendarBodySchema
>;

export const replaceProviderCapacityBodySchema = z
  .object({
    maxSimultaneousTeams: z.number().int().min(1).max(50),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
    reasonCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type ReplaceProviderCapacityBody = z.infer<
  typeof replaceProviderCapacityBodySchema
>;

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "endsAt must be an ISO datetime string" });

export const startProviderPauseBodySchema = z
  .object({
    endsAt: isoDateTimeSchema.nullable().optional(),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
    reasonCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type StartProviderPauseBody = z.infer<typeof startProviderPauseBodySchema>;

export const resumeProviderPauseBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    idempotencyKey: z.string().uuid("idempotencyKey must be a UUID"),
    reasonCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type ResumeProviderPauseBody = z.infer<typeof resumeProviderPauseBodySchema>;
