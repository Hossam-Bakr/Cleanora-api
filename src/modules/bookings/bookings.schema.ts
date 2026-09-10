import { z } from "zod";

export const browseLocaleSchema = z.enum(["AR", "EN"]);
export const browseIdSchema = z.string().trim().min(1).max(64);
export const browseCountryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((value) => value.toUpperCase());

const forbiddenGeoKeys = [
  "lat",
  "lng",
  "latitude",
  "longitude",
  "radius",
  "coordinates",
  "map",
  "socket",
] as const;

function rejectForbiddenGeo<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    if (value === null || typeof value !== "object") {
      return;
    }
    for (const key of forbiddenGeoKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Geographic and realtime browse parameters are not supported",
        });
      }
    }
  });
}

/** Foundation schema shared by eligible list and detail handlers. */
export const browseEvaluationContextQuerySchema = rejectForbiddenGeo(
  z
    .object({
      serviceId: browseIdSchema,
      countryId: browseIdSchema,
      cityId: browseIdSchema,
      districtId: browseIdSchema.optional(),
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
      crewPreference: z.enum(["all_male", "all_female", "any"]),
      requiredTeamUnits: z.coerce.number().int().min(1).max(50),
      locale: browseLocaleSchema,
    })
    .strict()
    .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
      path: ["endsAt"],
      message: "endsAt must be after startsAt",
    }),
);

export type BrowseEvaluationContextQuery = z.infer<
  typeof browseEvaluationContextQuerySchema
>;

export const browseServicesQuerySchema = rejectForbiddenGeo(
  z
    .object({
      countryCode: browseCountryCodeSchema,
      locale: browseLocaleSchema,
      cursor: z.string().trim().min(1).max(512).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
);

export const browseServiceParamsSchema = z
  .object({
    serviceId: browseIdSchema,
  })
  .strict();

export const browseServiceQuerySchema = rejectForbiddenGeo(
  z
    .object({
      countryCode: browseCountryCodeSchema,
      locale: browseLocaleSchema,
    })
    .strict(),
);

export const browseCountryParamsSchema = z
  .object({
    countryCode: browseCountryCodeSchema,
  })
  .strict();

export const browseCityParamsSchema = z
  .object({
    countryCode: browseCountryCodeSchema,
    cityId: browseIdSchema,
  })
  .strict();

export const browseProvidersQuerySchema = rejectForbiddenGeo(
  browseEvaluationContextQuerySchema.and(
    z
      .object({
        maxPriceAmount: z
          .string()
          .trim()
          .regex(/^[0-9]+(?:\.[0-9]+)?$/)
          .optional(),
        q: z.string().trim().min(1).max(160).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().trim().min(1).max(2048).optional(),
      })
      .strict(),
  ),
);

export type BrowseProvidersQuery = z.infer<typeof browseProvidersQuerySchema>;

export const browseProviderDetailParamsSchema = z
  .object({
    providerId: browseIdSchema,
    teamId: browseIdSchema,
  })
  .strict();

export const browseProviderDetailQuerySchema = rejectForbiddenGeo(
  browseEvaluationContextQuerySchema,
);
