import { z } from "zod";

export const idempotencyKeySchema = z.string().trim().min(1).max(128);
export const bookingIdSchema = z.string().trim().min(1).max(64);

const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);

export const bookingAnswerInputSchema = z
  .object({
    fieldId: z.string().trim().min(1).max(64),
    value: answerValueSchema,
  })
  .strict();

const CLIENT_TOTAL_KEYS = ["gross", "deposit", "total", "price"] as const;

export const createBookingBodySchema = z
  .object({
    serviceId: z.string().trim().min(1).max(64),
    providerId: z.string().trim().min(1).max(64),
    teamId: z.string().trim().min(1).max(64),
    countryId: z.string().trim().min(1).max(64),
    cityId: z.string().trim().min(1).max(64),
    districtId: z.string().trim().min(1).max(64).optional(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    crewPreference: z.enum(["all_male", "all_female", "any"]),
    requiredTeamUnits: z.number().int().min(1).max(50),
    locale: z.enum(["AR", "EN"]),
    userAddressId: z.string().trim().min(1).max(64),
    notes: z.string().trim().max(2000).optional(),
    answers: z.array(bookingAnswerInputSchema).max(50).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const allowed = new Set([
      "serviceId",
      "providerId",
      "teamId",
      "countryId",
      "cityId",
      "districtId",
      "startsAt",
      "endsAt",
      "crewPreference",
      "requiredTeamUnits",
      "locale",
      "userAddressId",
      "notes",
      "answers",
    ]);
    for (const forbidden of CLIENT_TOTAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, forbidden)) {
        ctx.addIssue({
          code: "custom",
          path: [forbidden],
          message: "Client totals are not accepted",
        });
      }
    }
    for (const key of Object.keys(value)) {
      if (!allowed.has(key) && !CLIENT_TOTAL_KEYS.includes(key as (typeof CLIENT_TOTAL_KEYS)[number])) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Unrecognized key",
        });
      }
    }
  })
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    path: ["endsAt"],
    message: "endsAt must be after startsAt",
  })
  .transform((value) => ({
    serviceId: value.serviceId,
    providerId: value.providerId,
    teamId: value.teamId,
    countryId: value.countryId,
    cityId: value.cityId,
    ...(value.districtId === undefined ? {} : { districtId: value.districtId }),
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    crewPreference: value.crewPreference,
    requiredTeamUnits: value.requiredTeamUnits,
    locale: value.locale,
    userAddressId: value.userAddressId,
    ...(value.notes === undefined ? {} : { notes: value.notes }),
    ...(value.answers === undefined ? {} : { answers: value.answers }),
  }));

export type CreateBookingBody = z.infer<typeof createBookingBodySchema>;

export const patchBookingBodySchema = z
  .object({
    version: z.number().int().positive(),
    notes: z.string().trim().max(2000).nullable().optional(),
    userAddressId: z.string().trim().min(1).max(64).optional(),
    answers: z.array(bookingAnswerInputSchema).max(50).optional(),
  })
  .strict();

export type PatchBookingBody = z.infer<typeof patchBookingBodySchema>;

export const bookingVersionBodySchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();

export type BookingVersionBody = z.infer<typeof bookingVersionBodySchema>;

export const cancelBookingBodySchema = z
  .object({
    version: z.number().int().positive(),
    reason: z.enum([
      "CUSTOMER_CHANGED_MIND",
      "CUSTOMER_WRONG_DETAILS",
      "OTHER",
    ]),
  })
  .strict();

export type CancelBookingBody = z.infer<typeof cancelBookingBodySchema>;

export const attachBookingMediaBodySchema = z
  .object({
    version: z.number().int().positive(),
    mediaId: z.string().trim().min(1).max(64),
  })
  .strict();

export type AttachBookingMediaBody = z.infer<typeof attachBookingMediaBodySchema>;

export const listBookingsQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z
      .enum(["DRAFT", "AWAITING_DEPOSIT", "CONFIRMED", "CANCELLED"])
      .optional(),
  })
  .strict();

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;

export const bookingParamsSchema = z
  .object({
    bookingId: bookingIdSchema,
  })
  .strict();
