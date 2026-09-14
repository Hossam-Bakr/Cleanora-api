import { z } from "zod";

export const assignmentProviderBookingParamsSchema = z
  .object({
    providerId: z.string().trim().min(1).max(64),
    bookingId: z.string().trim().min(1).max(64),
  })
  .strict();

export const assignTeamBodySchema = z
  .object({
    expectedBookingVersion: z.number().int().positive(),
    teamId: z.string().trim().min(1).max(64),
  })
  .strict();

export const assignWorkersBodySchema = z
  .object({
    expectedBookingVersion: z.number().int().positive(),
    workerIds: z.array(z.string().trim().min(1).max(64)).min(1).max(40),
  })
  .strict();
