import { z } from "zod";

const requiredText = z
  .string()
  .trim()
  .min(1, "This field is required")
  .max(200, "This field is too long");

export const individualProfileBody = z
  .object({ fullName: requiredText })
  .strict();

export const companyProfileBody = z
  .object({
    companyName: requiredText,
    representativeFullName: requiredText,
  })
  .strict();

export const engineerProfileBody = z
  .object({
    fullName: requiredText,
    professionalTitle: requiredText,
  })
  .strict();

export const emptyBody = z.object({}).strict();

const optionalText = z
  .string()
  .trim()
  .max(200, "This field is too long")
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const addressWriteBody = z
  .object({
    countryCode: z.string().trim().toUpperCase().length(2),
    city: requiredText,
    district: requiredText,
    addressText: requiredText,
    building: optionalText,
    floor: optionalText,
    notes: optionalText,
  })
  .strict();

export const addressUpdateBody = addressWriteBody.extend({
  version: z.number().int().positive(),
}).strict();

export const versionBody = z.object({
  version: z.number().int().positive(),
}).strict();

export const profileImageDeleteBody = z
  .object({
    expectedAssociationVersion: z.number().int().positive(),
  })
  .strict();

export const addressIdParams = z.object({
  addressId: z.string().trim().min(1).max(128),
}).strict();

export const privacyRequestIdParams = z.object({
  privacyRequestId: z.string().trim().min(1).max(128),
}).strict();

export const privacyRequestSubmitBody = z.object({
  purpose: z.enum(["DEACTIVATION", "DELETION", "EXPORT"]),
}).strict();

const preferenceChannelBody = z.object({
  sms: z.boolean(),
  push: z.boolean(),
}).strict();

export const preferencesPutBody = z.object({
  version: z.number().int().positive(),
  language: z.enum(["AR", "EN"]).nullable(),
  reminders: preferenceChannelBody,
  promotional: preferenceChannelBody,
  mandatory: z.object({
    security: z.object({ sms: z.literal(true), push: z.literal(true) }).strict(),
    activeService: z.object({ sms: z.literal(true), push: z.literal(true) }).strict(),
  }).strict(),
}).strict();
