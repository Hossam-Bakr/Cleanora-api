import { z } from "zod";

/**
 * Shared Zod boundary schemas for protected Catalog management commands.
 * Trusted actor identity is never accepted from the client body.
 */

export const catalogIdempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe("Client-supplied idempotency key");

export const catalogExpectedVersionSchema = z
  .number()
  .int()
  .positive()
  .describe("Exact aggregate version for CAS");

export const catalogReasonCodeSchema = z.literal("catalog_management_change");

export const catalogCommandBaseSchema = z
  .object({
    idempotencyKey: catalogIdempotencyKeySchema,
    reasonCode: catalogReasonCodeSchema,
  })
  .strict();

export const catalogVersionedCommandSchema = catalogCommandBaseSchema
  .extend({
    expectedVersion: catalogExpectedVersionSchema,
  })
  .strict();

export const catalogLocaleSchema = z.enum(["AR", "EN"]);

export const catalogStableCodeSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[A-Z][A-Z0-9_]*$/);

export const catalogCursorQuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

/**
 * Internal Catalog identifiers stay opaque to clients. The boundary enforces
 * only a safe non-empty length so a malformed value fails as validation rather
 * than as an unexpected persistence error.
 */
export const catalogIdSchema = z.string().trim().min(1).max(64);

export const catalogCategoryIdParamsSchema = z
  .object({
    categoryId: catalogIdSchema,
  })
  .strict();

export const catalogServiceIdParamsSchema = z
  .object({
    serviceId: catalogIdSchema,
  })
  .strict();

const nullableLocalizedName = z.string().trim().min(1).max(160).nullable();

const nullableLocalizedDescription = z.string().trim().min(1).max(2000).nullable();

/**
 * Localized keys are required but nullable so an omitted field can never be
 * confused with an explicitly cleared draft value.
 */
export const localizedCategoryContentSchema = z
  .object({
    nameAr: nullableLocalizedName,
    nameEn: nullableLocalizedName,
    descriptionAr: nullableLocalizedDescription,
    descriptionEn: nullableLocalizedDescription,
  })
  .strict();

export const serviceTranslationInputSchema = z
  .object({
    locale: catalogLocaleSchema,
    name: nullableLocalizedName,
    description: nullableLocalizedDescription,
  })
  .strict();

const uniqueLocales = (
  value: { readonly translations: readonly { readonly locale: string }[] },
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  for (const translation of value.translations) {
    if (seen.has(translation.locale)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["translations"],
        message: "Catalog translations repeat a locale",
      });
      return;
    }
    seen.add(translation.locale);
  }
};

export const createCategoryBodySchema = catalogCommandBaseSchema
  .merge(localizedCategoryContentSchema)
  .extend({
    code: catalogStableCodeSchema.min(2).max(80),
  })
  .strict();

export const replaceCategoryBodySchema = catalogVersionedCommandSchema
  .merge(localizedCategoryContentSchema)
  .strict();

export const categoryLifecycleBodySchema = catalogVersionedCommandSchema
  .extend({
    action: z.enum(["ACTIVATE", "DEACTIVATE"]),
  })
  .strict();

export const createServiceBodySchema = catalogCommandBaseSchema
  .extend({
    categoryId: catalogIdSchema,
    code: catalogStableCodeSchema.min(2).max(100),
    translations: z.array(serviceTranslationInputSchema).max(2),
  })
  .strict()
  .superRefine(uniqueLocales);

export const moveServiceBodySchema = catalogVersionedCommandSchema
  .extend({
    categoryId: catalogIdSchema,
  })
  .strict();

export const serviceLifecycleBodySchema = catalogVersionedCommandSchema
  .extend({
    action: z.enum(["ACTIVATE", "DEACTIVATE"]),
  })
  .strict();

export const listCategoriesQuerySchema = catalogCursorQuerySchema;

export const listServicesQuerySchema = catalogCursorQuerySchema
  .extend({
    categoryId: catalogIdSchema.optional(),
  })
  .strict();

export const replaceServiceTranslationsBodySchema = catalogVersionedCommandSchema
  .extend({
    translations: z.array(serviceTranslationInputSchema).max(2),
  })
  .strict()
  .superRefine(uniqueLocales);

export type CatalogCursorQuery = z.infer<typeof catalogCursorQuerySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type ReplaceCategoryBody = z.infer<typeof replaceCategoryBodySchema>;
export type CategoryLifecycleBody = z.infer<typeof categoryLifecycleBodySchema>;
export type CreateServiceBody = z.infer<typeof createServiceBodySchema>;
export type MoveServiceBody = z.infer<typeof moveServiceBodySchema>;
export type ServiceLifecycleBody = z.infer<typeof serviceLifecycleBodySchema>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type ServiceTranslationInput = z.infer<typeof serviceTranslationInputSchema>;
export type ReplaceServiceTranslationsBody = z.infer<
  typeof replaceServiceTranslationsBodySchema
>;

const nullableLocalizedLabel = z.string().trim().min(1).max(120).nullable();
const nullableFieldLabel = z.string().trim().min(1).max(300).nullable();
const nullableHelpText = z.string().trim().min(1).max(1000).nullable();
const nullableOptionLabel = z.string().trim().min(1).max(200).nullable();

const decimalBoundSchema = z
  .string()
  .trim()
  .regex(/^-?[0-9]+(?:\.[0-9]{1,3})?$/)
  .nullable();

const priceUnitInputSchema = z
  .object({
    code: catalogStableCodeSchema.min(2).max(64),
    labelAr: nullableLocalizedLabel,
    labelEn: nullableLocalizedLabel,
    isActive: z.boolean(),
  })
  .strict();

const fieldOptionInputSchema = z
  .object({
    value: catalogStableCodeSchema.min(1).max(80),
    labelAr: nullableOptionLabel,
    labelEn: nullableOptionLabel,
    isActive: z.boolean(),
  })
  .strict();

const fieldBaseSchema = z
  .object({
    code: catalogStableCodeSchema.min(2).max(80),
    labelAr: nullableFieldLabel,
    labelEn: nullableFieldLabel,
    helpTextAr: nullableHelpText,
    helpTextEn: nullableHelpText,
    isRequired: z.boolean(),
    isActive: z.boolean(),
    options: z.array(fieldOptionInputSchema),
  })
  .strict();

const informationFieldSchema = fieldBaseSchema
  .extend({
    kind: z.literal("INFORMATION"),
    isRequired: z.literal(false),
    minLength: z.null(),
    maxLength: z.null(),
    numberMode: z.null(),
    minValue: z.null(),
    maxValue: z.null(),
    minSelections: z.null(),
    maxSelections: z.null(),
    options: z.array(fieldOptionInputSchema).length(0),
  })
  .strict();

const textFieldSchema = fieldBaseSchema
  .extend({
    kind: z.literal("TEXT"),
    minLength: z.number().int().min(0).nullable(),
    maxLength: z.number().int().min(0).nullable(),
    numberMode: z.null(),
    minValue: z.null(),
    maxValue: z.null(),
    minSelections: z.null(),
    maxSelections: z.null(),
    options: z.array(fieldOptionInputSchema).length(0),
  })
  .strict();

const numberFieldSchema = fieldBaseSchema
  .extend({
    kind: z.literal("NUMBER"),
    minLength: z.null(),
    maxLength: z.null(),
    numberMode: z.enum(["INTEGER", "DECIMAL"]),
    minValue: decimalBoundSchema,
    maxValue: decimalBoundSchema,
    minSelections: z.null(),
    maxSelections: z.null(),
    options: z.array(fieldOptionInputSchema).length(0),
  })
  .strict();

const booleanFieldSchema = fieldBaseSchema
  .extend({
    kind: z.literal("BOOLEAN"),
    minLength: z.null(),
    maxLength: z.null(),
    numberMode: z.null(),
    minValue: z.null(),
    maxValue: z.null(),
    minSelections: z.null(),
    maxSelections: z.null(),
    options: z.array(fieldOptionInputSchema).length(0),
  })
  .strict();

const singleSelectFieldSchema = fieldBaseSchema
  .extend({
    kind: z.literal("SINGLE_SELECT"),
    minLength: z.null(),
    maxLength: z.null(),
    numberMode: z.null(),
    minValue: z.null(),
    maxValue: z.null(),
    minSelections: z.null(),
    maxSelections: z.null(),
    options: z.array(fieldOptionInputSchema).min(1),
  })
  .strict();

const multiSelectFieldSchema = fieldBaseSchema
  .extend({
    kind: z.literal("MULTI_SELECT"),
    minLength: z.null(),
    maxLength: z.null(),
    numberMode: z.null(),
    minValue: z.null(),
    maxValue: z.null(),
    minSelections: z.number().int().min(0).nullable(),
    maxSelections: z.number().int().min(0).nullable(),
    options: z.array(fieldOptionInputSchema).min(1),
  })
  .strict();

export const fieldInputSchema = z.discriminatedUnion("kind", [
  informationFieldSchema,
  textFieldSchema,
  numberFieldSchema,
  booleanFieldSchema,
  singleSelectFieldSchema,
  multiSelectFieldSchema,
]);

const uniqueFieldCodes = (
  value: { readonly fields: readonly { readonly code: string }[] },
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  for (const field of value.fields) {
    if (seen.has(field.code)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: "Catalog fields repeat a stable code",
      });
      return;
    }
    seen.add(field.code);
  }
};

const uniquePriceUnitCodes = (
  value: { readonly priceUnits: readonly { readonly code: string }[] },
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  for (const unit of value.priceUnits) {
    if (seen.has(unit.code)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceUnits"],
        message: "Catalog price units repeat a stable code",
      });
      return;
    }
    seen.add(unit.code);
  }
};

const uniqueOptionValues = (
  value: { readonly fields: readonly { readonly options: readonly { readonly value: string }[] }[] },
  context: z.RefinementCtx,
): void => {
  value.fields.forEach((field, fieldIndex) => {
    const seen = new Set<string>();
    for (const option of field.options) {
      if (seen.has(option.value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", fieldIndex, "options"],
          message: "Catalog field options repeat a stable value",
        });
        return;
      }
      seen.add(option.value);
    }
  });
};

/**
 * US2 configuration replacement excludes countries/availability (US3).
 */
export const replaceServiceConfigurationBodySchema = catalogVersionedCommandSchema
  .extend({
    translations: z.array(serviceTranslationInputSchema).max(2),
    priceUnits: z.array(priceUnitInputSchema),
    fields: z.array(fieldInputSchema),
  })
  .strict()
  .superRefine(uniqueLocales)
  .superRefine(uniquePriceUnitCodes)
  .superRefine(uniqueFieldCodes)
  .superRefine(uniqueOptionValues);

export type PriceUnitInput = z.infer<typeof priceUnitInputSchema>;
export type FieldOptionInput = z.infer<typeof fieldOptionInputSchema>;
export type FieldInput = z.infer<typeof fieldInputSchema>;
export type ReplaceServiceConfigurationBody = z.infer<
  typeof replaceServiceConfigurationBodySchema
>;

const orderItemSchema = z
  .object({
    id: catalogIdSchema,
    expectedVersion: catalogExpectedVersionSchema,
  })
  .strict();

export const replaceCategoryOrderBodySchema = catalogCommandBaseSchema
  .extend({
    items: z.array(orderItemSchema).min(1),
  })
  .strict();

export const replaceServiceOrderBodySchema = catalogCommandBaseSchema
  .extend({
    categoryId: catalogIdSchema,
    items: z.array(orderItemSchema).min(1),
  })
  .strict();

export const countryAvailabilityInputSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/),
    isAvailable: z.boolean(),
  })
  .strict();

const uniqueCountryCodes = (
  value: { readonly countries: readonly { readonly countryCode: string }[] },
  context: z.RefinementCtx,
): void => {
  const seen = new Set<string>();
  for (const country of value.countries) {
    const normalized = country.countryCode.trim().toUpperCase();
    if (seen.has(normalized)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["countries"],
        message: "Catalog availability countries repeat a country code",
      });
      return;
    }
    seen.add(normalized);
  }
};

export const replaceServiceAvailabilityBodySchema = catalogVersionedCommandSchema
  .extend({
    countries: z.array(countryAvailabilityInputSchema),
  })
  .strict()
  .superRefine(uniqueCountryCodes);

export const uploadServiceMediaFieldsSchema = catalogVersionedCommandSchema
  .extend({
    expectedVersion: z.coerce.number().int().positive(),
  })
  .strict();

export const reorderServiceMediaBodySchema = catalogVersionedCommandSchema
  .extend({
    orderedAssociationIds: z
      .array(catalogIdSchema)
      .min(0)
      .superRefine((ids, context) => {
        if (new Set(ids).size !== ids.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Media order association ids must be unique",
          });
        }
      }),
  })
  .strict();

export const removeServiceMediaBodySchema = catalogVersionedCommandSchema.strict();

export const catalogMediaAssociationParamsSchema = z
  .object({
    serviceId: catalogIdSchema,
    associationId: catalogIdSchema,
  })
  .strict();

export type ReplaceCategoryOrderBody = z.infer<typeof replaceCategoryOrderBodySchema>;
export type ReplaceServiceOrderBody = z.infer<typeof replaceServiceOrderBodySchema>;
export type ReplaceServiceAvailabilityBody = z.infer<
  typeof replaceServiceAvailabilityBodySchema
>;
export type CountryAvailabilityInput = z.infer<typeof countryAvailabilityInputSchema>;
export type UploadServiceMediaFields = z.infer<typeof uploadServiceMediaFieldsSchema>;
export type ReorderServiceMediaBody = z.infer<typeof reorderServiceMediaBodySchema>;
export type RemoveServiceMediaBody = z.infer<typeof removeServiceMediaBodySchema>;
