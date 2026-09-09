/**
 * Zod boundary schemas for Staff locality/time-zone HTTP endpoints.
 * Controllers must validate params/body with these before calling the service.
 */

import { z } from "zod";

import { isRecognizedIanaTimeZone } from "./time-zone.js";

const localityCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/u, "must be an identifier-style code");

const localizedNameSchema = z.string().trim().min(1).max(200);

const uuidLikeIdempotencyKeySchema = z
  .string()
  .uuid("idempotencyKey must be a UUID");

const reasonTextSchema = z.string().trim().min(1).max(1000);

const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z][A-Za-z_]*(?:\/[A-Za-z][A-Za-z0-9_+-]*){1,2}$/u,
    "must be a valid IANA time zone identifier (e.g. Africa/Cairo)",
  )
  .refine(isRecognizedIanaTimeZone, "must be a recognized IANA time zone");

export const countryIdParamsSchema = z
  .object({ countryId: z.string().trim().min(1) })
  .strict();

export const cityIdParamsSchema = z
  .object({ cityId: z.string().trim().min(1) })
  .strict();

export const cityDistrictsParamsSchema = z
  .object({ cityId: z.string().trim().min(1) })
  .strict();

export const districtIdParamsSchema = z
  .object({ districtId: z.string().trim().min(1) })
  .strict();

export const createCityBodySchema = z
  .object({
    code: localityCodeSchema,
    nameAr: localizedNameSchema,
    nameEn: localizedNameSchema,
    idempotencyKey: uuidLikeIdempotencyKeySchema,
    reasonCode: z.string().trim().min(1).max(100),
  })
  .strict();

export const patchCityBodySchema = z
  .object({
    nameAr: localizedNameSchema.optional(),
    nameEn: localizedNameSchema.optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().min(1),
    idempotencyKey: uuidLikeIdempotencyKeySchema,
    reasonCode: z.string().trim().min(1).max(100),
  })
  .strict()
  .refine(
    (body) =>
      body.nameAr !== undefined ||
      body.nameEn !== undefined ||
      body.isActive !== undefined,
    { message: "at least one field must change" },
  );

export const createDistrictBodySchema = z
  .object({
    code: localityCodeSchema,
    nameAr: localizedNameSchema,
    nameEn: localizedNameSchema,
    idempotencyKey: uuidLikeIdempotencyKeySchema,
    reasonCode: z.string().trim().min(1).max(100),
  })
  .strict();

export const patchDistrictBodySchema = z
  .object({
    nameAr: localizedNameSchema.optional(),
    nameEn: localizedNameSchema.optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().min(1),
    idempotencyKey: uuidLikeIdempotencyKeySchema,
    reasonCode: z.string().trim().min(1).max(100),
  })
  .strict()
  .refine(
    (body) =>
      body.nameAr !== undefined ||
      body.nameEn !== undefined ||
      body.isActive !== undefined,
    { message: "at least one field must change" },
  );

export const putCountryTimeZoneBodySchema = z
  .object({
    timeZone: timeZoneSchema,
    /** `0` when no country time zone is configured yet, else the current version. */
    expectedVersion: z.number().int().min(0),
    idempotencyKey: uuidLikeIdempotencyKeySchema,
    reasonCode: z.string().trim().min(1).max(100),
  })
  .strict();

export type CreateCityBody = z.infer<typeof createCityBodySchema>;
export type PatchCityBody = z.infer<typeof patchCityBodySchema>;
export type CreateDistrictBody = z.infer<typeof createDistrictBodySchema>;
export type PatchDistrictBody = z.infer<typeof patchDistrictBodySchema>;
export type PutCountryTimeZoneBody = z.infer<
  typeof putCountryTimeZoneBodySchema
>;
export { reasonTextSchema };
